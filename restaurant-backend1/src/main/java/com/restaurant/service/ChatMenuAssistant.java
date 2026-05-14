package com.restaurant.service;

import com.restaurant.ai.AiMenuRecommendationService;
import com.restaurant.ai.GeminiMenuSuggestionService;
import com.restaurant.chat.intent.ChatIntent;
import com.restaurant.chat.intent.IntentFilters;
import com.restaurant.chat.intent.IntentMatcher;
import com.restaurant.chat.intent.PriceFilter;
import com.restaurant.dto.response.ChatResponse;
import com.restaurant.dto.response.menu_items.MenuItemResponse;
import com.restaurant.entity.AiSystemConfig;
import com.restaurant.entity.Category;
import com.restaurant.entity.ChatbotMessage;
import com.restaurant.entity.MenuItem;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.AiSuggestionSource;
import com.restaurant.entity.enums.ChatMessageSender;
import com.restaurant.mapper.MenuItemMapper;
import com.restaurant.repository.AiSystemConfigRepository;
import com.restaurant.repository.CategoryRepository;
import com.restaurant.repository.ChatbotMessageRepository;
import com.restaurant.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Trợ lý menu của chatbot: nhận tin nhắn khách, phân loại {@link ChatIntent} và
 * gọi recommender tương ứng.
 *
 * <p>Mỗi intent đi qua một nhánh business logic riêng (không chia sẻ pool đầu ra).
 * Khi intent KHÔNG khớp đặc thù nào → mới fallback về top phổ biến (có thể rerank bằng Gemini).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ChatMenuAssistant {

    /** Số món gợi ý mặc định trên một lượt trả lời. */
    private static final int DEFAULT_SUGGESTION_LIMIT = 5;
    /** Khi liệt kê theo chủ đề (sushi / hải sản) cho phép hiện rộng hơn. */
    private static final int LISTING_LIMIT = 12;
    /** Thông điệp khi đã lọc theo điều kiện giá nhưng không còn món nào. */
    private static final String NO_MATCH_MESSAGE = "Hiện không có món phù hợp yêu cầu của bạn.";

    private final MenuItemRepository menuItemRepository;
    private final CategoryRepository categoryRepository;
    private final MenuItemMapper menuItemMapper;
    private final ChatbotMessageRepository chatbotMessageRepository;
    private final AiSystemConfigRepository aiSystemConfigRepository;
    private final AiMenuRecommendationService aiMenuRecommendationService;
    private final GeminiMenuSuggestionService geminiMenuSuggestionService;
    private final AiSuggestionLogService aiSuggestionLogService;

    @Value("${google.gemini.api.key:}")
    private String geminiApiKey;

    // ============================================================
    // PUBLIC API — kept backward compatible with ChatService
    // ============================================================

    /** Giữ tương thích với {@link ChatService}: nhận biết câu chào không kèm chủ đề khác. */
    public static boolean isStandaloneGreeting(String msg) {
        return IntentMatcher.isStandaloneGreeting(msg == null ? "" : msg);
    }

    /**
     * Đường vào chính từ {@link ChatService}: tổng hợp intent rồi dispatch.
     *
     * <p>Trả {@link Optional#empty()} khi không khớp intent menu nào — caller có thể
     * tiếp tục các nhánh khác (booking flow…).
     */
    public Optional<ChatResponse> tryAnswerMenuQuestion(String sessionId, User user, String raw, String msg) {
        if (!StringUtils.hasText(msg)) {
            return Optional.empty();
        }

        ChatIntent intent = IntentMatcher.detect(msg);
        switch (intent) {
            case GREETING:
            case BOOKING:
            case UNKNOWN:
                return Optional.empty();
            default:
                return Optional.of(dispatch(intent, sessionId, user, raw, msg));
        }
    }

    /**
     * @deprecated giữ tạm để không phá tương thích, nay luôn ủy quyền cho
     *             {@link #tryAnswerMenuQuestion(String, User, String, String)}. Sẽ xóa khi
     *             {@link ChatService} không còn gọi tới.
     */
    @Deprecated
    public Optional<ChatResponse> tryAnswerTastyCategoryPicks(String sessionId, User user, String raw, String msg) {
        if (!StringUtils.hasText(msg)) {
            return Optional.empty();
        }
        ChatIntent intent = IntentMatcher.detect(msg);
        if (intent == ChatIntent.MEAT || intent == ChatIntent.SUSHI || intent == ChatIntent.SEAFOOD) {
            return Optional.of(dispatch(intent, sessionId, user, raw, msg));
        }
        return Optional.empty();
    }

    /**
     * Sinh gợi ý phổ biến (POPULAR_FALLBACK) — có thể nhờ Gemini rerank.
     * Dùng khi ChatService rơi vào nhánh "menu/món/ăn gì/gợi ý" nhưng không khớp intent đặc thù.
     */
    public ChatResponse suggestPopularDishes(String sessionId, User user, String rawUserMessage,
                                             String titleOverride, Set<Long> restrictToIds) {
        if (aiDisabledBlocking()) {
            return aiDisabledReply(sessionId, user);
        }
        AiSystemConfig cfg = aiMenuRecommendationService.loadConfig();

        List<MenuItem> base = aiMenuRecommendationService.recommendTop(LISTING_LIMIT, true);
        if (restrictToIds != null && !restrictToIds.isEmpty()) {
            base = base.stream().filter(m -> restrictToIds.contains(m.getId())).collect(Collectors.toList());
        }

        AiSuggestionSource source = AiSuggestionSource.RULE_ENGINE;

        if (Boolean.TRUE.equals(cfg.getGeminiEnabled())
                && StringUtils.hasText(geminiApiKey) && !base.isEmpty()) {
            int to = cfg.getGeminiTimeoutMs() != null ? cfg.getGeminiTimeoutMs() : 2800;
            List<Long> geminiIds = geminiMenuSuggestionService.suggestOrderedIds(rawUserMessage, base, to);
            if (!geminiIds.isEmpty()) {
                base = mergeByGeminiOrder(base, geminiIds);
                source = AiSuggestionSource.HYBRID;
            }
        }

        List<MenuItem> diverse = IntentFilters.diversifyByCategory(base, DEFAULT_SUGGESTION_LIMIT, 2);

        if (diverse.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }

        String title = titleOverride != null && !titleOverride.isBlank()
                ? titleOverride
                : "Vài món hot bạn có thể thích 👌";
        return buildMenuResponseWithLog(sessionId, user, title, diverse, source);
    }

    // ============================================================
    // INTENT DISPATCH
    // ============================================================

    private ChatResponse dispatch(ChatIntent intent, String sessionId, User user, String raw, String msg) {
        if (aiDisabledBlocking()) {
            return aiDisabledReply(sessionId, user);
        }

        return switch (intent) {
            case DESSERT          -> handleDessert(sessionId, user, msg);
            case SPICY            -> handleSpicy(sessionId, user, msg);
            case VEGETARIAN       -> handleVegetarian(sessionId, user);
            case MOST_EXPENSIVE   -> handleMostExpensive(sessionId, user);
            case CHEAPEST         -> handleCheapest(sessionId, user, msg);
            case BUDGET           -> handleBudget(sessionId, user, raw, msg);
            case TOP_SELLING      -> handleTopSelling(sessionId, user);
            case TOP_RATED        -> handleTopRated(sessionId, user);
            case LOW_RATED        -> handleLowRated(sessionId, user);
            case SUSHI            -> handleSushi(sessionId, user, msg);
            case SEAFOOD          -> handleSeafood(sessionId, user, msg);
            case MEAT             -> handleMeat(sessionId, user, msg);
            case HEALTHY          -> handleHealthy(sessionId, user);
            case SIGNATURE        -> handleSignature(sessionId, user);
            case MENU_OVERVIEW    -> handleMenuOverview(sessionId, user);
            case POPULAR_FALLBACK -> suggestPopularDishes(sessionId, user, raw, null, null);
            case BY_CATEGORY      -> handleCategoryFallback(sessionId, user, msg);
            default               -> replyPersist(sessionId, user, friendlyFallback());
        };
    }

    // ============================================================
    // HANDLERS — mỗi intent có business logic riêng
    // ============================================================

    private ChatResponse handleDessert(String sessionId, User user, String msg) {
        List<MenuItem> all = loadActivePool();
        List<MenuItem> picks = IntentFilters.filterDessert(all);
        if (log.isDebugEnabled()) {
            log.debug("[chat][DESSERT] pool={} picks={} → {}", all.size(), picks.size(),
                    picks.stream().map(MenuItem::getName).collect(Collectors.toList()));
        }
        if (picks.isEmpty()) {
            return softFallback(sessionId, user,
                    "Quán chưa có món tráng miệng phù hợp lúc này. Anh/chị thử món ngọt phổ biến nhé:");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        int n = IntentMatcher.isMenuListingFollowup(msg) ? LISTING_LIMIT : DEFAULT_SUGGESTION_LIMIT;
        return buildRule(sessionId, user, "Tráng miệng / món ngọt được nhiều khách chọn 🍰",
                IntentFilters.takeFirst(picks, n));
    }

    private ChatResponse handleSpicy(String sessionId, User user, String msg) {
        List<MenuItem> all = loadActivePool();
        List<MenuItem> picks = IntentFilters.filterSpicy(all);
        if (log.isDebugEnabled()) {
            log.debug("[chat][SPICY] pool={} picks={} → {}", all.size(), picks.size(),
                    picks.stream().map(MenuItem::getName).collect(Collectors.toList()));
        }
        if (picks.isEmpty()) {
            return softFallback(sessionId, user,
                    "Quán chưa có món cay đặc trưng đang phục vụ. Anh/chị xem vài lựa chọn đậm đà này nhé:");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        int n = IntentMatcher.isMenuListingFollowup(msg) ? LISTING_LIMIT : DEFAULT_SUGGESTION_LIMIT;
        return buildRule(sessionId, user, "Món cay / kích vị 🌶️",
                IntentFilters.takeFirst(picks, n));
    }

    private ChatResponse handleVegetarian(String sessionId, User user) {
        List<MenuItem> all = loadActivePool();
        List<MenuItem> picks = IntentFilters.filterVegetarian(all);
        if (picks.isEmpty()) {
            return softFallback(sessionId, user,
                    "Tạm thời em chưa thấy món hoàn toàn chay trong thực đơn. Anh/chị có thể yêu cầu bếp chế biến nhẹ giúp ạ.");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        picks = IntentFilters.diversifyByCategory(picks, DEFAULT_SUGGESTION_LIMIT, 2);
        return buildRule(sessionId, user, "Lựa chọn chay / không thịt 🥗", picks);
    }

    private ChatResponse handleMostExpensive(String sessionId, User user) {
        List<MenuItem> all = loadActivePool();
        List<MenuItem> sorted = IntentFilters.sortPriceDesc(all);
        List<MenuItem> top = IntentFilters.takeFirst(sorted, DEFAULT_SUGGESTION_LIMIT);
        if (top.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }
        return buildRule(sessionId, user, "Top món có giá cao nhất hiện tại 💎", top);
    }

    /**
     * Intent CHEAPEST — "món rẻ nhất / giá thấp nhất".
     *
     * <p>Quy tắc:
     * <ul>
     *   <li>Khách <b>explicit</b> hỏi đồ uống (vd. "nước rẻ nhất") → trả top đồ uống ASC.</li>
     *   <li>Còn lại (mặc định ưu tiên food, kể cả khi câu hỏi mơ hồ "rẻ nhất") →
     *       chỉ trả món ăn ASC, loại đồ uống ra khỏi top.</li>
     *   <li>Nếu pool food trống → fallback sang đồ uống để không trả về list rỗng.</li>
     * </ul>
     */
    private ChatResponse handleCheapest(String sessionId, User user, String msg) {
        List<MenuItem> all = loadActivePool();
        boolean wantsBeverage = IntentMatcher.isBeverageIntent(msg)
                && !IntentMatcher.isFoodIntent(msg);

        if (wantsBeverage) {
            List<MenuItem> bev = IntentFilters.sortPriceAsc(IntentFilters.onlyBeverages(all));
            List<MenuItem> top = IntentFilters.takeFirst(bev, DEFAULT_SUGGESTION_LIMIT);
            if (top.isEmpty()) {
                return softFallback(sessionId, user,
                        "Hiện chưa có đồ uống nào trong thực đơn. Anh/chị thử lựa chọn khác nhé:");
            }
            return buildRule(sessionId, user, "Đồ uống có giá tiết kiệm nhất 🥤", top);
        }

        boolean excludeBev = IntentMatcher.shouldExcludeBeverages(ChatIntent.CHEAPEST, msg);
        List<MenuItem> pool = excludeBev ? IntentFilters.excludeBeverages(all) : all;
        if (pool.isEmpty() && excludeBev) {
            pool = all; // fallback nếu thực đơn không có food
        }
        List<MenuItem> sorted = IntentFilters.sortPriceAsc(pool);
        List<MenuItem> top = IntentFilters.takeFirst(sorted, DEFAULT_SUGGESTION_LIMIT);
        if (top.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }
        String title = excludeBev
                ? "Top món ăn có giá tiết kiệm nhất 💰"
                : "Top món có giá tiết kiệm nhất 💰";
        return buildRule(sessionId, user, title, top);
    }

    /**
     * Intent BUDGET — câu hỏi theo giá:
     * <ul>
     *   <li>"món dưới 50k" / "&lt;50"  → max-only</li>
     *   <li>"món trên 100k" / "&gt;100" → min-only</li>
     *   <li>"từ 50k đến 100k"         → range</li>
     *   <li>"rẻ" / "tiết kiệm" / "ngân sách" không kèm số → không cap; chỉ sắp xếp giá tăng dần</li>
     * </ul>
     *
     * <p>Trình tự xử lý:
     * <ol>
     *   <li>Parse {@link PriceFilter} <b>trước</b>.</li>
     *   <li>Lọc menu theo khoảng giá ngay trong code (không phụ thuộc AI).</li>
     *   <li>Mới gửi danh sách đã lọc sang Gemini rerank (nếu có).</li>
     *   <li>Pool sau lọc rỗng ⇒ trả thông điệp "Hiện không có món phù hợp yêu cầu của bạn."</li>
     * </ol>
     */
    private ChatResponse handleBudget(String sessionId, User user, String raw, String msg) {
        PriceFilter filter = IntentMatcher.extractPriceFilter(msg);

        List<MenuItem> all = loadActivePool();
        List<MenuItem> within = filter.isEmpty()
                ? new ArrayList<>(all)
                : IntentFilters.filterByPriceRange(all, filter.minVnd(), filter.maxVnd());

        if (within.isEmpty()) {
            return replyPersist(sessionId, user, NO_MATCH_MESSAGE);
        }

        boolean wantsBeverage = IntentMatcher.isBeverageIntent(msg)
                && !IntentMatcher.isFoodIntent(msg);
        within = IntentFilters.sortPriceAsc(within);

        List<MenuItem> picks;
        if (wantsBeverage) {
            List<MenuItem> bev = IntentFilters.onlyBeverages(within);
            picks = IntentFilters.diversifyByCategory(bev, DEFAULT_SUGGESTION_LIMIT, 3);
        } else if (IntentMatcher.shouldExcludeBeverages(ChatIntent.BUDGET, msg)) {
            List<MenuItem> food = IntentFilters.excludeBeverages(within);
            List<MenuItem> foodDiversified = IntentFilters.diversifyByCategory(
                    food, DEFAULT_SUGGESTION_LIMIT, 2);
            if (foodDiversified.size() >= DEFAULT_SUGGESTION_LIMIT) {
                picks = foodDiversified;
            } else {
                picks = IntentFilters.foodFirstThenBeverages(within, DEFAULT_SUGGESTION_LIMIT);
            }
        } else {
            picks = IntentFilters.diversifyByCategory(within, DEFAULT_SUGGESTION_LIMIT, 2);
        }

        if (picks.isEmpty()) {
            return replyPersist(sessionId, user, NO_MATCH_MESSAGE);
        }

        // Gửi danh sách đã lọc sang Gemini để rerank (nếu bật & có key).
        AiSuggestionSource source = AiSuggestionSource.RULE_ENGINE;
        AiSystemConfig cfg = aiMenuRecommendationService.loadConfig();
        if (Boolean.TRUE.equals(cfg.getGeminiEnabled())
                && StringUtils.hasText(geminiApiKey) && !picks.isEmpty()) {
            int to = cfg.getGeminiTimeoutMs() != null ? cfg.getGeminiTimeoutMs() : 2800;
            List<Long> geminiIds = geminiMenuSuggestionService.suggestOrderedIds(raw, picks, to);
            if (!geminiIds.isEmpty()) {
                picks = mergeByGeminiOrder(picks, geminiIds);
                source = AiSuggestionSource.HYBRID;
            }
        }

        String title = buildBudgetTitle(filter, wantsBeverage);
        return buildMenuResponseWithLog(sessionId, user, title, picks, source);
    }

    /** Tiêu đề trả về phụ thuộc khoảng giá khách yêu cầu (không hardcode mức cố định). */
    private static String buildBudgetTitle(PriceFilter f, boolean wantsBeverage) {
        String subject = wantsBeverage ? "đồ uống" : "món";
        if (f.isRange()) {
            return "Top " + subject + " giá từ " + formatK(f.minVnd()) + " đến " + formatK(f.maxVnd()) + " 👌";
        }
        if (f.hasMax()) {
            return "Top " + subject + " có giá dưới " + formatK(f.maxVnd()) + " 💰";
        }
        if (f.hasMin()) {
            return "Top " + subject + " có giá trên " + formatK(f.minVnd()) + " 💎";
        }
        return "Top " + subject + " có giá tiết kiệm 💰";
    }

    /** Đổi VND sang chuỗi "Xk" cho thân thiện. */
    private static String formatK(int vnd) {
        return (vnd / 1000) + "k";
    }

    private ChatResponse handleTopSelling(String sessionId, User user) {
        List<MenuItem> top = aiMenuRecommendationService.recommendTopSellingFood(DEFAULT_SUGGESTION_LIMIT);
        if (top.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }
        return buildRule(sessionId, user, "Top món được khách gọi nhiều nhất 🔥", top);
    }

    private ChatResponse handleTopRated(String sessionId, User user) {
        List<MenuItem> top = aiMenuRecommendationService.recommendTopRatedFood(DEFAULT_SUGGESTION_LIMIT);
        if (top.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }
        return buildRule(sessionId, user, "Những món được đánh giá cao nhất ⭐", top);
    }

    private ChatResponse handleLowRated(String sessionId, User user) {
        List<MenuItem> bot = aiMenuRecommendationService.recommendLowRatedFood(DEFAULT_SUGGESTION_LIMIT);
        if (bot.isEmpty()) {
            return replyPersist(sessionId, user,
                    "Hiện chưa có món nào bị đánh giá thấp đáng kể — anh/chị yên tâm gọi nhé.");
        }
        return buildRule(sessionId, user, "Một vài món có rating thấp để anh/chị cân nhắc 🤔", bot);
    }

    private ChatResponse handleSushi(String sessionId, User user, String msg) {
        List<MenuItem> picks = IntentFilters.filterSushi(loadActivePool());
        if (picks.isEmpty()) {
            return softFallback(sessionId, user,
                    "Hôm nay chưa có sushi/sashimi trong thực đơn. Anh/chị thử món hải sản nóng nhé:");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        int n = IntentMatcher.isMenuListingFollowup(msg) ? LISTING_LIMIT : DEFAULT_SUGGESTION_LIMIT;
        return buildRule(sessionId, user, "Sushi / sashimi đang có 🍣",
                IntentFilters.takeFirst(picks, n));
    }

    private ChatResponse handleSeafood(String sessionId, User user, String msg) {
        List<MenuItem> picks = IntentFilters.filterSeafood(loadActivePool());
        if (picks.isEmpty()) {
            return softFallback(sessionId, user, "Chưa có món hải sản phù hợp lúc này.");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        int n = IntentMatcher.isMenuListingFollowup(msg) ? LISTING_LIMIT : DEFAULT_SUGGESTION_LIMIT;
        return buildRule(sessionId, user, "Hải sản đang phục vụ 🦞",
                IntentFilters.takeFirst(picks, n));
    }

    private ChatResponse handleMeat(String sessionId, User user, String msg) {
        List<MenuItem> picks = IntentFilters.filterMeatFocused(loadActivePool());
        if (picks.isEmpty()) {
            return softFallback(sessionId, user, "Chưa có món thịt phù hợp lúc này.");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        int n = IntentMatcher.isMenuListingFollowup(msg) ? LISTING_LIMIT : DEFAULT_SUGGESTION_LIMIT;
        return buildRule(sessionId, user, "Món thịt được nhiều khách khen 🥩",
                IntentFilters.takeFirst(picks, n));
    }

    private ChatResponse handleHealthy(String sessionId, User user) {
        List<MenuItem> picks = IntentFilters.filterHealthy(loadActivePool());
        if (picks.isEmpty()) {
            return softFallback(sessionId, user,
                    "Em chưa thấy món thật sự 'healthy' trong thực đơn — thử nhóm salad/rau nhé:");
        }
        picks = IntentFilters.sortBy(picks, IntentFilters.bySoldThenRating());
        return buildRule(sessionId, user, "Món nhẹ / ăn lành 🥗",
                IntentFilters.takeFirst(picks, DEFAULT_SUGGESTION_LIMIT));
    }

    private ChatResponse handleSignature(String sessionId, User user) {
        List<MenuItem> sig = aiMenuRecommendationService.recommendTop(DEFAULT_SUGGESTION_LIMIT, true);
        if (sig.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }
        return buildRule(sessionId, user, "Signature của quán ✨", sig);
    }

    private ChatResponse handleMenuOverview(String sessionId, User user) {
        List<Category> cats = categoryRepository.findByIsActiveTrueOrderBySortOrderAsc();
        List<MenuItem> top = aiMenuRecommendationService.recommendTop(LISTING_LIMIT, true);
        List<MenuItem> diverse = IntentFilters.diversifyByCategory(top, DEFAULT_SUGGESTION_LIMIT, 1);
        String groups = cats.isEmpty() ? ""
                : "Quán đang có các nhóm: "
                + cats.stream().map(Category::getName).collect(Collectors.joining(", "))
                + ". ";
        return buildRule(sessionId, user, groups + "Vài món tiêu biểu để anh/chị tham khảo 📖", diverse);
    }

    /** Khi user nhắc tên category trong tin nhắn (ưu tiên sau intent đặc thù). */
    private ChatResponse handleCategoryFallback(String sessionId, User user, String msg) {
        return matchCategory(sessionId, user, msg).orElseGet(() ->
                replyPersist(sessionId, user, friendlyFallback()));
    }

    // ============================================================
    // HELPERS
    // ============================================================

    /**
     * Khớp tên category trực tiếp trong câu — gọi trước khi rơi vào BY_CATEGORY.
     * Đặt ở public để {@link ChatService} có thể gọi sau khi IntentMatcher trả UNKNOWN.
     */
    public Optional<ChatResponse> matchCategory(String sessionId, User user, String msg) {
        if (!StringUtils.hasText(msg)) {
            return Optional.empty();
        }
        List<MenuItem> pool = loadActivePool();
        for (Category c : categoryRepository.findByIsActiveTrueOrderBySortOrderAsc()) {
            if (c.getName() == null || c.getName().isBlank()) {
                continue;
            }
            String key = c.getName().trim().toLowerCase(Locale.ROOT);
            if (msg.contains(key)) {
                List<MenuItem> inCat = pool.stream()
                        .filter(mi -> mi.getCategory() != null
                                && Objects.equals(mi.getCategory().getId(), c.getId()))
                        .sorted(IntentFilters.bySoldThenRating())
                        .collect(Collectors.toList());
                if (!inCat.isEmpty()) {
                    return Optional.of(buildRule(sessionId, user,
                            "Món trong nhóm «" + c.getName().trim() + "»",
                            IntentFilters.takeFirst(inCat, DEFAULT_SUGGESTION_LIMIT)));
                }
            }
        }
        return Optional.empty();
    }

    private List<MenuItem> loadActivePool() {
        return menuItemRepository.findAllActiveAvailableWithCategory();
    }

    private static List<MenuItem> mergeByGeminiOrder(List<MenuItem> ruleOrdered, List<Long> geminiIds) {
        Map<Long, MenuItem> map = ruleOrdered.stream()
                .collect(Collectors.toMap(MenuItem::getId, m -> m, (a, b) -> a));
        List<MenuItem> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (Long id : geminiIds) {
            MenuItem m = map.get(id);
            if (m != null && seen.add(id)) {
                out.add(m);
            }
        }
        for (MenuItem m : ruleOrdered) {
            if (seen.add(m.getId())) {
                out.add(m);
            }
        }
        return out;
    }

    private ChatResponse buildRule(String sessionId, User user, String title, List<MenuItem> items) {
        return buildMenuResponseWithLog(sessionId, user, title, items, AiSuggestionSource.RULE_ENGINE);
    }

    private ChatResponse buildMenuResponseWithLog(String sessionId, User user, String title,
                                                  List<MenuItem> items, AiSuggestionSource source) {
        if (items == null || items.isEmpty()) {
            return replyPersist(sessionId, user, friendlyFallback());
        }
        List<MenuItemResponse> data = menuItemMapper.toResponseList(items);
        List<Long> ids = items.stream().map(MenuItem::getId).toList();
        Long logId = aiSuggestionLogService.logSuggestion(sessionId, source, ids, title);

        ChatResponse response = ChatResponse.builder()
                .reply(title)
                .status("success")
                .data(data)
                .suggestionLogId(logId)
                .build();

        persistMessage(sessionId, user, ChatMessageSender.BOT, title);
        return response;
    }

    private ChatResponse softFallback(String sessionId, User user, String customMessage) {
        // Fallback có hướng dẫn intent gần đúng + vài món phổ biến
        List<MenuItem> popular = aiMenuRecommendationService.recommendTop(DEFAULT_SUGGESTION_LIMIT, true);
        if (popular.isEmpty()) {
            return replyPersist(sessionId, user, customMessage);
        }
        return buildRule(sessionId, user, customMessage, popular);
    }

    private boolean aiDisabledBlocking() {
        Optional<AiSystemConfig> cfg = aiSystemConfigRepository.findById(AiSystemConfig.SINGLETON_ID);
        return cfg.isPresent() && !Boolean.TRUE.equals(cfg.get().getAiEnabled());
    }

    private ChatResponse aiDisabledReply(String sessionId, User user) {
        ChatResponse r = replyPlain(
                "Tính năng gợi ý thông minh đang tạm tắt. Anh/chị xem đầy đủ thực đơn tại trang Menu nhé.");
        persistMessage(sessionId, user, ChatMessageSender.BOT, r.getReply());
        return r;
    }

    private void persistMessage(String sessionId, User user, ChatMessageSender sender, String message) {
        try {
            ChatbotMessage entity = ChatbotMessage.builder()
                    .sessionId(sessionId)
                    .user(user)
                    .sender(sender)
                    .message(message == null ? "" : message)
                    .build();
            chatbotMessageRepository.save(entity);
        } catch (Exception ignored) {
            // Lưu chat là best-effort, không chặn câu trả lời
        }
    }

    private ChatResponse replyPlain(String msg) {
        return ChatResponse.builder()
                .reply(msg)
                .status("success")
                .data(null)
                .suggestionLogId(null)
                .build();
    }

    private ChatResponse replyPersist(String sessionId, User user, String text) {
        ChatResponse r = replyPlain(text);
        persistMessage(sessionId, user, ChatMessageSender.BOT, text);
        return r;
    }

    private String friendlyFallback() {
        return "Em chưa rõ ý lắm. Anh/chị thử hỏi như:\n"
                + "• \"gợi ý món ngon\" — top phổ biến\n"
                + "• \"món chay\" / \"món cay\" / \"món ngọt\" — theo khẩu vị\n"
                + "• \"món dưới 100k\" — theo ngân sách\n"
                + "• \"đặt bàn tối mai 19:30 cho 4 người\" — đặt chỗ nhanh.";
    }
}

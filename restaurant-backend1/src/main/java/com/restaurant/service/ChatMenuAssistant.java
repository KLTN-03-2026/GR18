package com.restaurant.service;

import com.restaurant.ai.AiMenuRecommendationService;
import com.restaurant.ai.GeminiMenuSuggestionService;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatMenuAssistant {

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

    public Optional<ChatResponse> tryAnswerMenuQuestion(String sessionId, User user, String raw, String msg) {
        if (!StringUtils.hasText(msg)) {
            return Optional.empty();
        }

        List<MenuItem> pool = menuItemRepository.findAllActiveAvailableWithCategory();

        if (wantMostExpensiveDishes(msg)) {
            List<MenuItem> exp = new ArrayList<>(pool);
            exp.sort(Comparator.comparingDouble((MenuItem m) ->
                            m.getPrice() != null ? m.getPrice().doubleValue() : 0).reversed());
            List<MenuItem> top = takeFirst(exp, 6);
            if (!top.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món có giá cao nhất (đang bán, từ cao đến thấp):", top));
            }
        }

        if (wantCheapestExplicit(msg)) {
            List<MenuItem> ch = new ArrayList<>(pool);
            ch.sort(Comparator.comparingDouble(m -> m.getPrice() != null ? m.getPrice().doubleValue() : Double.MAX_VALUE));
            List<MenuItem> bot = takeFirst(ch, 6);
            if (!bot.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món có giá thấp nhất (đang bán, từ thấp đến cao):", bot));
            }
        }

        if (msg.contains("bán chạy")
                || (msg.contains("nhiều người") && msg.contains("gọi"))
                || (msg.contains("hôm nay") && msg.contains("gọi") && msg.contains("món"))) {
            return Optional.of(ruleEngineOrDisabled(sessionId, user,
                    "Món bán chạy / được gọi nhiều:",
                    menuItemRepository.findTopSellingItems(PageRequest.of(0, 5))));
        }
        if (msg.contains("đánh giá cao") || msg.contains("rating") || msg.contains("review hay")) {
            return Optional.of(ruleEngineOrDisabled(sessionId, user,
                    "Món được khách đánh giá cao:",
                    menuItemRepository.findTopRatedItems(PageRequest.of(0, 5))));
        }
        if (msg.contains("rẻ") || msg.contains("tiết kiệm") || msg.contains("sinh viên")
                || msg.contains("túi tiền")) {
            Optional<Integer> cap = extractPriceCapVnd(msg);
            double max = cap.map(Integer::doubleValue).orElse(120_000D);
            List<MenuItem> cheap = menuItemRepository.findByPriceLessThan(max);
            return Optional.of(ruleEngineOrDisabled(sessionId, user,
                    "Món giá dễ chịu / tiết kiệm:", takeFirst(cheap, 6)));
        }

        Optional<Integer> capOpt = extractPriceCapVnd(msg);
        if (capOpt.isPresent() && (msg.contains("dưới") || msg.contains("nhỏ hơn")
                || msg.contains("lọc") || msg.contains("ngân sách"))) {
            int cap = capOpt.get();
            List<MenuItem> sub = pool.stream()
                    .filter(m -> priceLe(m.getPrice(), cap))
                    .sorted(Comparator.comparingDouble(m -> m.getPrice() != null ? m.getPrice().doubleValue() : 0))
                    .collect(Collectors.toList());
            List<MenuItem> show = takeFirst(sub, 6);
            if (!show.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món trong ngân sách (~" + (cap / 1000) + "k trở xuống):", show));
            }
            return Optional.of(replyPersist(sessionId, user,
                    "Chưa thấy món nào phù hợp mức giá đó trong dữ liệu hiện tại — anh/chị thử mức khác hoặc xem trang Menu ạ."));
        }

        for (Category c : categoryRepository.findByIsActiveTrueOrderBySortOrderAsc()) {
            if (c.getName() == null || c.getName().isBlank()) {
                continue;
            }
            String key = c.getName().trim().toLowerCase(Locale.ROOT);
            if (msg.contains(key)) {
                List<MenuItem> inCat = pool.stream()
                        .filter(mi -> mi.getCategory() != null
                                && Objects.equals(mi.getCategory().getId(), c.getId()))
                        .sorted(bySoldThenRating())
                        .collect(Collectors.toList());
                if (!inCat.isEmpty()) {
                    return Optional.of(ruleEngineOrDisabled(sessionId, user,
                            "Món trong nhóm «" + c.getName().trim() + "»:", takeFirst(inCat, 6)));
                }
            }
        }

        Optional<List<MenuItem>> syn = matchSynonymGroups(msg, pool);
        if (syn.isPresent() && !syn.get().isEmpty()) {
            return Optional.of(ruleEngineOrDisabled(sessionId, user,
                    "Món gợi ý theo ý hỏi:", takeFirst(syn.get(), 6)));
        }

        if (msg.contains("không cay") || msg.contains("ít cay") || msg.contains("it cay")) {
            List<MenuItem> f = pool.stream()
                    .filter(m -> {
                        String b = menuSearchBlob(m);
                        return b.contains("không cay") || b.contains("ít cay") || b.contains("it cay")
                                || (!b.contains("cay") && !b.contains("ớt"));
                    })
                    .sorted(bySoldThenRating())
                    .collect(Collectors.toList());
            if (!f.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món ít cay / không cay (theo mô tả trên menu):", takeFirst(f, 6)));
            }
        }
        if (msg.contains("cay") && (msg.contains("món") || msg.contains("có ") || msg.contains("ko ") || msg.contains("không"))) {
            List<MenuItem> spicy = filterAnyKeyword(pool, "cay", "ớt", "chilli", "spicy");
            if (!spicy.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món có vị cay / ớt (theo mô tả):", takeFirst(spicy, 6)));
            }
        }

        if (msg.contains("chay") || msg.contains("vegan") || msg.contains("vegetarian")) {
            List<MenuItem> v = filterAnyKeyword(pool, "chay", "vegan", "vegetarian", "rau ", "đậu hũ");
            if (!v.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món chay / ít thịt (theo mô tả):", takeFirst(v, 6)));
            }
        }
        if (msg.contains("healthy") || msg.contains("ít dầu") || msg.contains("ít calo")
                || msg.contains("ăn kiêng") || msg.contains("gym") || msg.contains("fitness")) {
            List<MenuItem> h = filterAnyKeyword(pool, "salad", "rau", "healthy", "luộc", "hấp", "ít dầu", "light");
            if (!h.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món nhẹ / ít dầu (theo mô tả):", takeFirst(h, 6)));
            }
        }
        if (msg.contains("gluten") || msg.contains("không gluten")) {
            List<MenuItem> g = filterAnyKeyword(pool, "gluten", "không gluten", "không bột mì");
            if (!g.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món ghi chú liên quan gluten (kiểm tra với nhân viên khi dị ứng):", takeFirst(g, 6)));
            }
        }
        if (msg.contains("đậu phộng") || msg.contains("lạc ") || msg.contains("peanut")) {
            List<MenuItem> p = filterAnyKeyword(pool, "đậu phộng", "peanut", "lạc");
            if (!p.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món có thể chứa đậu phộng / lạc (theo mô tả):", takeFirst(p, 6)));
            }
        }
        if (((msg.contains("sữa") || msg.contains("cream") || msg.contains("cheese") || msg.contains("phô mai"))
                && (msg.contains(" có ") || msg.contains(" món ") || msg.contains("thành phần") || msg.contains("dị ứng")))
                && !(msg.contains("cà phê") || msg.contains("cafe") || msg.contains("café"))) {
            List<MenuItem> d = filterAnyKeyword(pool, "sữa", "cheese", "phô mai", "bơ sữa", "cream");
            if (!d.isEmpty()) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user,
                        "Món có sữa / phô mai (theo mô tả):", takeFirst(d, 6)));
            }
        }

        if (msg.contains("combo") && (msg.contains("tiết kiệm") || msg.contains("rẻ") || msg.contains("nhất"))) {
            List<MenuItem> sorted = new ArrayList<>(pool);
            sorted.sort(Comparator.comparingDouble(m -> m.getPrice() != null ? m.getPrice().doubleValue() : 0));
            return Optional.of(ruleEngineOrDisabled(sessionId, user,
                    "Món / combo gợi ý theo mức giá:", takeFirst(sorted, 6)));
        }

        if (msg.contains("signature") || msg.contains("đặc trưng") || msg.contains("nổi bật")
                || msg.contains("hot trend") || msg.matches("(?s).*món.*chuẩn quán.*")) {
            List<MenuItem> sig = aiMenuRecommendationService.recommendTop(5);
            return Optional.of(ruleEngineOrDisabled(sessionId, user,
                    "Món nổi bật / signature của quán:", sig));
        }

        if (msg.matches("(?s).*\\d+\\s*người.*")
                && (msg.contains("ăn") || msg.contains("gọi") || msg.contains("hợp")
                || msg.contains("combo nhóm") || msg.contains("suất ") || msg.contains("nhóm"))) {
            Matcher gm = Pattern.compile("(\\d+)\\s*người").matcher(msg);
            int n = gm.find() ? Integer.parseInt(gm.group(1)) : 2;
            return Optional.of(suggestPopularDishes(sessionId, user, raw,
                    "Gợi ý nhóm ~" + n + " người (chia sẻ thêm một vài món phổ biến):", null));
        }

        if (mentionsMenuOverview(msg)) {
            List<Category> cats = categoryRepository.findByIsActiveTrueOrderBySortOrderAsc();
            String groups = cats.isEmpty() ? ""
                    : " Hiện quán có các nhóm: "
                    + cats.stream().map(Category::getName).collect(Collectors.joining(", "))
                    + ".";
            ChatResponse cx = ruleEngineOrDisabled(sessionId, user,
                    groups + " Một vài món được nhiều khách thích:",
                    aiMenuRecommendationService.recommendTop(5));
            return Optional.of(cx);
        }

        if ((msg.contains("bao lâu") || msg.contains("chờ lâu") || msg.contains("ra nhanh")
                || msg.contains("ăn liền"))
                && (msg.contains("món"))) {
            return Optional.of(replyPersist(sessionId, user,
                    "Em không lưu thời gian chuẩn bị từng món trong hệ thống — còn tùy tảng giờ bếp. "
                            + "Thông thường gỏi/khai vị và đồ uống sẽ nhanh hơn món hầm, nướng chín tái. "
                            + "Khách vui lòng hỏi nhân viên khi vào nhà hàng nhé."));
        }

        if (msg.contains("thành phần") || msg.contains("dị ứng") || msg.contains(" có hải sản không")
                || msg.contains("có chứa") || msg.matches("(?s).*món này .*giá.*")) {
            String title = null;
            if (msg.contains("giá") || msg.matches("(?s).*giá bao nhiêu.*")) {
                title = "Gợi ý món liên quan (xem chi tiết giá từng món trong danh sách):";
            }
            return Optional.of(suggestPopularDishes(sessionId, user, raw, title, null));
        }

        boolean compare = msg.contains("so sánh") || msg.contains("nên chọn") || msg.contains("đáng tiền")
                || (msg.contains("khác ") && msg.contains("thế nào")) || msg.contains("ngon hơn");
        if (compare && (msg.contains("món") || msg.matches("(?s).*món .*món.*"))) {
            return Optional.of(suggestPopularDishes(sessionId, user, raw,
                    "So sánh nhanh bằng các món còn bán trong thực đơn (chọn và xem chi tiết):",
                    Collections.emptySet()));
        }

        if ((msg.contains("ảnh") || msg.contains("hình ") || msg.contains("photo"))
                && (msg.contains("món") || msg.matches("(?s).*\\w+.+"))) {
            return Optional.of(suggestPopularDishes(sessionId, user, raw,
                    "Một số món có ảnh trên Menu — vuốt xem thẻ bên dưới:",
                    Collections.emptySet()));
        }

        if (msg.contains("lọc ") && (msg.contains("không cay") || msg.contains(" chay ")
                || msg.contains(" chay ") || msg.contains("bán chạy"))) {
            if (msg.contains("bán chạy")) {
                return Optional.of(ruleEngineOrDisabled(sessionId, user, "Lọc món bán chạy:",
                        menuItemRepository.findTopSellingItems(PageRequest.of(0, 5))));
            }
        }

        if (looksCasualFoodQuestion(msg)) {
            return Optional.of(suggestPopularDishes(sessionId, user, raw, null, null));
        }

        return Optional.empty();
    }

    public ChatResponse suggestPopularDishes(String sessionId, User user, String rawUserMessage,
                                             String titleOverride, Set<Long> restrictToIds) {
        Optional<AiSystemConfig> cfgOpt = aiSystemConfigRepository.findById(AiSystemConfig.SINGLETON_ID);
        if (cfgOpt.isPresent() && !Boolean.TRUE.equals(cfgOpt.get().getAiEnabled())) {
            return aiDisabledReply(sessionId, user);
        }

        AiSystemConfig cfg = cfgOpt.orElse(null);

        List<MenuItem> base = aiMenuRecommendationService.recommendTop(12);
        if (restrictToIds != null && !restrictToIds.isEmpty()) {
            Set<Long> allow = restrictToIds;
            base = base.stream().filter(m -> allow.contains(m.getId())).collect(Collectors.toList());
        }
        AiSuggestionSource source = AiSuggestionSource.RULE_ENGINE;

        if (cfg != null && Boolean.TRUE.equals(cfg.getGeminiEnabled())
                && StringUtils.hasText(geminiApiKey) && !base.isEmpty()) {
            int to = cfg.getGeminiTimeoutMs() != null ? cfg.getGeminiTimeoutMs() : 2800;
            List<Long> geminiIds = geminiMenuSuggestionService.suggestOrderedIds(rawUserMessage, base, to);
            if (!geminiIds.isEmpty()) {
                base = mergeByGeminiOrder(base, geminiIds);
                source = AiSuggestionSource.HYBRID;
            }
        }

        if (base.size() > 5) {
            base = new ArrayList<>(base.subList(0, 5));
        }

        if (base.isEmpty()) {
            ChatResponse r = replyPlain("Hiện chưa có món phù hợp để gợi ý.");
            persistMessage(sessionId, user, ChatMessageSender.BOT, r.getReply());
            return r;
        }

        String title = titleOverride != null && !titleOverride.isBlank()
                ? titleOverride
                : "Một vài món bạn có thể thích:";
        return buildMenuResponseWithLog(sessionId, user, title, base, source);
    }

    private static List<MenuItem> mergeByGeminiOrder(List<MenuItem> ruleOrdered, List<Long> geminiIds) {
        Map<Long, MenuItem> map = ruleOrdered.stream().collect(Collectors.toMap(MenuItem::getId, m -> m, (a, b) -> a));
        List<MenuItem> out = new ArrayList<>();
        for (Long id : geminiIds) {
            MenuItem m = map.get(id);
            if (m != null) {
                out.add(m);
            }
        }
        for (MenuItem m : ruleOrdered) {
            if (out.stream().noneMatch(x -> x.getId().equals(m.getId()))) {
                out.add(m);
            }
        }
        return out;
    }

    private ChatResponse buildMenuResponseWithLog(
            String sessionId,
            User user,
            String title,
            List<MenuItem> items,
            AiSuggestionSource source) {

        if (items == null || items.isEmpty()) {
            ChatResponse r = replyPlain("Hiện chưa có dữ liệu món cho gợi ý này.");
            persistMessage(sessionId, user, ChatMessageSender.BOT, r.getReply());
            return r;
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

    private ChatResponse ruleEngineOrDisabled(String sessionId, User user, String title, List<MenuItem> items) {
        if (aiDisabledBlocking()) {
            return aiDisabledReply(sessionId, user);
        }
        return buildMenuResponseWithLog(sessionId, user, title, items, AiSuggestionSource.RULE_ENGINE);
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

    private static String menuSearchBlob(MenuItem m) {
        String nm = Optional.ofNullable(m.getName()).orElse("");
        String dsc = Optional.ofNullable(m.getDescription()).orElse("");
        String cat = "";
        if (m.getCategory() != null) {
            cat = Optional.ofNullable(m.getCategory().getName()).orElse("")
                    + " " + Optional.ofNullable(m.getCategory().getDescription()).orElse("");
        }
        return (nm + " " + dsc + " " + cat).toLowerCase(Locale.ROOT);
    }

    private static List<MenuItem> filterAnyKeyword(List<MenuItem> pool, String... keys) {
        return pool.stream()
                .filter(m -> {
                    String b = menuSearchBlob(m);
                    for (String k : keys) {
                        if (b.contains(k.toLowerCase(Locale.ROOT))) {
                            return true;
                        }
                    }
                    return false;
                })
                .collect(Collectors.toList());
    }

    private static Comparator<MenuItem> bySoldThenRating() {
        return Comparator
                .comparing((MenuItem m) -> m.getTotalSold() == null ? 0 : m.getTotalSold()).reversed()
                .thenComparing((MenuItem m) -> m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0.0,
                        Comparator.reverseOrder());
    }

    private static List<MenuItem> takeFirst(List<MenuItem> items, int n) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return items.size() <= n ? items : items.subList(0, n);
    }

    private static boolean priceLe(BigDecimal p, int cap) {
        if (p == null) {
            return false;
        }
        return p.doubleValue() <= cap;
    }

    private static Optional<Integer> extractPriceCapVnd(String msg) {
        Matcher m1 = Pattern.compile("(?:dưới|không quá|<=)\\s*(\\d+)\\s*[kK]\\b").matcher(msg);
        if (m1.find()) {
            return Optional.of(Integer.parseInt(m1.group(1)) * 1000);
        }
        Matcher m2 = Pattern.compile("(?:dưới|không quá)\\s*(\\d{4,})\\s*(đ|dong|vnd)?").matcher(msg);
        if (m2.find()) {
            return Optional.of(Integer.parseInt(m2.group(1)));
        }
        Matcher m3 = Pattern.compile("(?<![0-9])(\\d{1,3})\\s*[kK]\\b").matcher(msg);
        if (m3.find() && (msg.contains("dưới") || msg.contains("lọc") || msg.contains("50k") || msg.contains("100k"))) {
            return Optional.of(Integer.parseInt(m3.group(1)) * 1000);
        }
        return Optional.empty();
    }

    private static boolean mentionsMenuOverview(String msg) {
        if (msg.contains("menu online") || msg.contains("combo không") || msg.contains("combo nhóm")) {
            return true;
        }
        boolean noun = msg.contains("menu ") || msg.contains("thực đơn") || msg.contains(" xem menu");
        boolean qa = msg.contains("có gì") || msg.contains("những gì") || msg.contains("bao nhiêu loại")
                || msg.contains("loại món") || msg.contains("đầy đủ") || msg.contains("có những");
        return noun && qa
                || msg.matches("(?s).*\\b(?:xin|cho)\\s+mình\\s+xem\\s+menu.*")
                || msg.strip().startsWith("menu ")
                || msg.contains("menu nhà có")
                || (msg.contains("hôm nay") && msg.contains("khác") && msg.contains("menu"));
    }

    private static boolean looksCasualFoodQuestion(String msg) {
        return msg.contains("đói") || msg.contains("ăn gì giờ") || msg.contains("có gì ngon không")
                || msg.contains(" có gì lạ ") || msg.contains("lạ lạ") || msg.contains("hay ho");
    }

    private static Optional<List<MenuItem>> matchSynonymGroups(String msg, List<MenuItem> pool) {
        record Group(String title, List<String> keys) {
        }

        Group[] gs = new Group[] {
                new Group("tráng miệng", List.of(
                        "tráng miệng", "dessert", " kem ", "bánh ngọt", "che ", "yaourt", "sinh tố")),
                new Group("đồ uống / cafe", List.of(
                        "đồ uống", "coffee", "cafe ", "beer", "bia ", "cocktail", "smoothie ", "sinh tố",
                        " trà ", "nước ép", " soda")),
                new Group("lẩu", List.of("lẩu", " lau ")),
                new Group("nướng / bbq", List.of("nướng", "bbq", "barbecue", "xiên nướng")),
                new Group("hải sản", List.of("hải sản", "tôm ", " cua ", " mực ", " sò ", "ghẹ", " ngao")),
                new Group("ăn nhanh", List.of("burger", "sandwich", "pizza", "fast food", "khoai tây chiên", "gà rán")),
        };

        for (Group g : gs) {
            boolean hit = g.keys.stream().anyMatch(k -> msg.contains(k.trim().toLowerCase(Locale.ROOT)));
            if (hit) {
                List<String> subKeys = g.keys.stream().map(s -> s.trim().toLowerCase(Locale.ROOT)).toList();
                List<MenuItem> out = pool.stream()
                        .filter(m -> {
                            String b = menuSearchBlob(m);
                            return subKeys.stream().anyMatch(b::contains);
                        })
                        .sorted(bySoldThenRating())
                        .collect(Collectors.toList());
                if (!out.isEmpty()) {
                    return Optional.of(out);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Chào không kèm hỏi menu/đặt bàn — xử lý sớm tại ChatService để không xóa phiên đặt bàn.
     */
    public static boolean isStandaloneGreeting(String msg) {
        String t = msg.strip();
        if (t.length() > 56) {
            return false;
        }
        if (t.contains("menu") || t.contains("món") || t.contains("đặt") || t.contains("đắt")
                || t.contains("booking")) {
            return false;
        }
        return t.matches("(?iu)^(xin\\s+chào|chào(\\s+(bạn|em|anh|chị))?|hello|hi|hey)([!?.\\s]*)$")
                || t.matches("(?iu)^chào[!?.\\s]*$");
    }

    /** Hỏi kiểu “đắt nhất”, “giá cao nhất” — không “không đắt”. */
    private static boolean wantMostExpensiveDishes(String msg) {
        if (msg.contains("không đắt") || msg.contains("hong đắt")) {
            return false;
        }
        return msg.contains("đắt nhất") || msg.contains("mắc nhất") || msg.contains("đắt tiền nhất")
                || msg.contains("top đắt") || msg.contains("giá cao nhất")
                || (msg.contains("giá") && msg.contains("cao nhất"))
                || msg.matches("(?s).*món[^.!?]{0,24}(đắt|mắc)[^.!?]{0,14}nhất.*");
    }

    /** So với câu “món rẻ” — khi có “nhất” / giá thấp nhất. */
    private static boolean wantCheapestExplicit(String msg) {
        return msg.contains("rẻ nhất") || msg.matches("(?s).*rẻ[^.!?]{0,10}nhất.*")
                || msg.contains("rẽ nhất")
                || msg.contains("giá thấp nhất");
    }
}

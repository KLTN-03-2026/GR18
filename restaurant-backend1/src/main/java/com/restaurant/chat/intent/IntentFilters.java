package com.restaurant.chat.intent;

import com.restaurant.entity.MenuItem;
import com.restaurant.menu.MenuCategoryRules;
import com.restaurant.menu.MenuKeywords;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Các bộ lọc thuần (không Spring/DB) áp dụng trên danh sách {@link MenuItem}.
 * Tách khỏi {@code ChatMenuAssistant} để có thể unit-test với fixture trong bộ nhớ.
 *
 * <p>Quy ước:
 * <ul>
 *   <li>Đầu vào là pool đã active + available (lấy từ repository).</li>
 *   <li>Đầu ra luôn là List ổn định, không bao giờ {@code null}.</li>
 *   <li>Việc sort, limit và diversify được tách thành các utility method độc lập.</li>
 * </ul>
 */
public final class IntentFilters {

    private IntentFilters() {
    }

    // ============================================================
    // Search blob — name + description + category
    // ============================================================

    public static String blob(MenuItem m) {
        return (nameLower(m) + " " + descLower(m) + " " + categoryBlob(m)).trim();
    }

    static String nameLower(MenuItem m) {
        return Optional.ofNullable(m.getName()).orElse("").toLowerCase(Locale.ROOT);
    }

    static String descLower(MenuItem m) {
        return Optional.ofNullable(m.getDescription()).orElse("").toLowerCase(Locale.ROOT);
    }

    static String categoryBlob(MenuItem m) {
        try {
            if (m.getCategory() != null && m.getCategory().getName() != null) {
                String n = m.getCategory().getName();
                String d = Optional.ofNullable(m.getCategory().getDescription()).orElse("");
                return (n + " " + d).toLowerCase(Locale.ROOT);
            }
        } catch (Exception ignored) {
            // Lazy/null — fail soft
        }
        return "";
    }

    private static boolean containsAny(String text, Collection<String> keys) {
        for (String k : keys) {
            if (text.contains(k.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    // ============================================================
    // DESSERT — món ngọt / tráng miệng
    // ============================================================

    /**
     * Chỉ trả món tráng miệng. Quy tắc <b>name-first</b>:
     * <ol>
     *   <li>Ưu tiên category "Tráng miệng / Dessert" — bắt được mọi món thuộc nhóm này.</li>
     *   <li>Còn lại: NAME phải chứa keyword dessert mạnh
     *       ({@link MenuKeywords#DESSERT_NAME_KEYS}).</li>
     *   <li>NAME có blacklist bánh mặn ({@link MenuKeywords#DESSERT_BLACKLIST}) → loại.</li>
     *   <li>Luôn loại đồ uống.</li>
     * </ol>
     *
     * <p>Vì sao không match description? Mô tả các món mặn thường có cụm
     * "vị ngọt thanh", "thoảng vị ngọt"… gây false-positive.
     */
    public static List<MenuItem> filterDessert(List<MenuItem> pool) {
        // Pass 1: category
        List<MenuItem> byCategory = pool.stream()
                .filter(m -> m.getCategory() != null && MenuCategoryRules.isDessertCategory(m.getCategory()))
                .collect(Collectors.toList());
        if (!byCategory.isEmpty()) {
            return byCategory;
        }
        // Pass 2: name keyword với blacklist bánh mặn
        return pool.stream()
                .filter(m -> !isBeverage(m))
                .filter(m -> {
                    String name = nameLower(m);
                    if (containsAny(name, MenuKeywords.DESSERT_BLACKLIST)) {
                        return false;
                    }
                    return containsAny(name, MenuKeywords.DESSERT_NAME_KEYS);
                })
                .collect(Collectors.toList());
    }

    // ============================================================
    // SPICY — món cay
    // ============================================================

    /**
     * Chỉ trả món thực sự cay. Quy tắc <b>name-first</b>:
     * <ol>
     *   <li>Negation ở name HOẶC description → loại ngay.</li>
     *   <li>NAME chứa keyword cay (cay/ớt/kimchi/sa tế/spicy/mala…) → pass.</li>
     *   <li>Description chứa <b>compound</b> rõ ràng ("vị cay", "sốt cay",
     *       "cay nồng", "cay xé"…) → pass.</li>
     *   <li>Còn lại — fail. Single mention "cay" trong description KHÔNG đủ tin cậy.</li>
     * </ol>
     */
    public static List<MenuItem> filterSpicy(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> {
                    String name = nameLower(m);
                    String desc = descLower(m);

                    if (containsAny(name, MenuKeywords.SPICY_NEGATION)
                            || containsAny(desc, MenuKeywords.SPICY_NEGATION)) {
                        return false;
                    }
                    if (containsAny(name, MenuKeywords.SPICY_NAME_KEYS)) {
                        return true;
                    }
                    return containsAny(desc, MenuKeywords.SPICY_DESC_COMPOUNDS);
                })
                .collect(Collectors.toList());
    }

    // ============================================================
    // VEGETARIAN — món chay
    // ============================================================

    /**
     * Quy tắc loại trừ chặt: bất kỳ keyword protein/hải sản nào xuất hiện trong
     * name/description/category đều loại món đó (kể cả "salad cá hồi"!).
     * <p>Sau đó ưu tiên món có whitelist signal; nếu vẫn rỗng → trả phần còn lại
     * (đã loại protein) — coi như "có thể ăn chay".
     */
    public static List<MenuItem> filterVegetarian(List<MenuItem> pool) {
        List<MenuItem> safe = pool.stream()
                .filter(m -> !isBeverage(m))
                .filter(m -> !containsAny(blob(m), MenuKeywords.NON_VEGETARIAN_BLACKLIST))
                .collect(Collectors.toList());

        List<MenuItem> withSignal = safe.stream()
                .filter(m -> containsAny(blob(m), MenuKeywords.VEGETARIAN_WHITELIST))
                .collect(Collectors.toList());

        return withSignal.isEmpty() ? safe : withSignal;
    }

    // ============================================================
    // SEAFOOD / MEAT / SUSHI / HEALTHY
    // ============================================================

    /** Hải sản: bắt buộc keyword trong NAME (tôm/cua/cá hồi/mực/hàu/seafood…). */
    public static List<MenuItem> filterSeafood(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> containsAny(nameLower(m), MenuKeywords.SEAFOOD_KEYWORDS))
                .collect(Collectors.toList());
    }

    /** Thịt: keyword trong NAME; loại dumpling (há cảo/gyoza dù có "thịt" trong nhân). */
    public static List<MenuItem> filterMeatFocused(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> {
                    String name = nameLower(m);
                    if (containsAny(name, MenuKeywords.DUMPLING_BLACKLIST)) {
                        return false;
                    }
                    return containsAny(name, MenuKeywords.MEAT_KEYWORDS);
                })
                .collect(Collectors.toList());
    }

    /** Sushi: keyword trong NAME. */
    public static List<MenuItem> filterSushi(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> containsAny(nameLower(m), MenuKeywords.SUSHI_KEYWORDS))
                .collect(Collectors.toList());
    }

    /** Healthy: name HOẶC category gợi ý nhẹ (salad/rau). Description không tin cậy. */
    public static List<MenuItem> filterHealthy(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> {
                    String name = nameLower(m);
                    String cat = categoryBlob(m);
                    return containsAny(name, MenuKeywords.HEALTHY_KEYWORDS)
                            || containsAny(cat, MenuKeywords.HEALTHY_KEYWORDS);
                })
                .collect(Collectors.toList());
    }

    // ============================================================
    // PRICE-BASED
    // ============================================================

    public static List<MenuItem> sortPriceDesc(List<MenuItem> pool) {
        List<MenuItem> copy = new ArrayList<>(pool);
        copy.sort(Comparator.comparingDouble((MenuItem m) ->
                m.getPrice() != null ? m.getPrice().doubleValue() : 0).reversed());
        return copy;
    }

    public static List<MenuItem> sortPriceAsc(List<MenuItem> pool) {
        List<MenuItem> copy = new ArrayList<>(pool);
        copy.sort(Comparator.comparingDouble((MenuItem m) ->
                m.getPrice() != null ? m.getPrice().doubleValue() : Double.MAX_VALUE));
        return copy;
    }

    public static List<MenuItem> filterByMaxPrice(List<MenuItem> pool, int capVnd) {
        return pool.stream()
                .filter(m -> {
                    BigDecimal p = m.getPrice();
                    return p != null && p.doubleValue() <= capVnd;
                })
                .collect(Collectors.toList());
    }

    // ============================================================
    // SORTING — sold then rating (default for "interesting picks")
    // ============================================================

    public static Comparator<MenuItem> bySoldThenRating() {
        return Comparator
                .comparing((MenuItem m) -> m.getTotalSold() == null ? 0 : m.getTotalSold()).reversed()
                .thenComparing((MenuItem m) -> m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0.0,
                        Comparator.reverseOrder());
    }

    public static Comparator<MenuItem> byRatingThenSold() {
        return Comparator
                .comparing((MenuItem m) -> m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0.0,
                        Comparator.reverseOrder())
                .thenComparing((MenuItem m) -> m.getTotalSold() == null ? 0 : m.getTotalSold(),
                        Comparator.reverseOrder());
    }

    public static List<MenuItem> sortBy(List<MenuItem> pool, Comparator<MenuItem> cmp) {
        List<MenuItem> copy = new ArrayList<>(pool);
        copy.sort(cmp);
        return copy;
    }

    // ============================================================
    // DIVERSIFY — tránh trùng category để mỗi intent có "mặt riêng"
    // ============================================================

    /**
     * Quét theo thứ tự, chỉ chọn tối đa {@code perCategory} món / category.
     * Khi đủ {@code limit} thì dừng; nếu chưa đủ, vòng 2 cho phép trùng category.
     */
    public static List<MenuItem> diversifyByCategory(List<MenuItem> ordered, int limit, int perCategory) {
        if (ordered == null || ordered.isEmpty() || limit <= 0) {
            return List.of();
        }
        Map<Long, Integer> seenPerCat = new HashMap<>();
        Set<Long> chosenIds = new LinkedHashSet<>();
        List<MenuItem> out = new ArrayList<>();

        for (MenuItem m : ordered) {
            if (out.size() >= limit) {
                break;
            }
            Long cid = m.getCategory() != null ? m.getCategory().getId() : -1L;
            int n = seenPerCat.getOrDefault(cid, 0);
            if (n < perCategory && chosenIds.add(m.getId())) {
                out.add(m);
                seenPerCat.put(cid, n + 1);
            }
        }
        // Vòng 2: nới điều kiện nếu chưa đủ
        if (out.size() < limit) {
            for (MenuItem m : ordered) {
                if (out.size() >= limit) {
                    break;
                }
                if (chosenIds.add(m.getId())) {
                    out.add(m);
                }
            }
        }
        return out;
    }

    public static List<MenuItem> takeFirst(List<MenuItem> items, int n) {
        if (items == null || items.isEmpty() || n <= 0) {
            return List.of();
        }
        return items.size() <= n ? new ArrayList<>(items) : new ArrayList<>(items.subList(0, n));
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private static boolean isBeverage(MenuItem m) {
        return m.getCategory() != null && MenuCategoryRules.isBeverageCategory(m.getCategory());
    }

    /** Chỉ giữ món đang active + available. Pool đã được repo lọc, dùng làm hàng rào kép. */
    public static List<MenuItem> onlyAvailable(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsActive())
                        && Boolean.TRUE.equals(m.getIsAvailable()))
                .collect(Collectors.toList());
    }

    // ============================================================
    // FOOD vs BEVERAGE split
    // ============================================================

    /** Loại bỏ mọi món thuộc category đồ uống ({@link MenuCategoryRules#isBeverageCategory}). */
    public static List<MenuItem> excludeBeverages(List<MenuItem> pool) {
        return pool.stream()
                .filter(m -> !isBeverage(m))
                .collect(Collectors.toList());
    }

    /** Chỉ giữ món thuộc category đồ uống. */
    public static List<MenuItem> onlyBeverages(List<MenuItem> pool) {
        return pool.stream()
                .filter(IntentFilters::isBeverage)
                .collect(Collectors.toList());
    }

    /**
     * "Food-first" composer cho intent giá rẻ:
     * <ol>
     *   <li>Lấy món ăn (sắp xếp theo {@code orderer}) trước, đủ {@code limit} thì dừng.</li>
     *   <li>Thiếu mới điền bằng đồ uống cuối danh sách.</li>
     * </ol>
     */
    public static List<MenuItem> foodFirstThenBeverages(List<MenuItem> ordered, int limit) {
        if (ordered == null || ordered.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<MenuItem> food = new ArrayList<>();
        List<MenuItem> bev = new ArrayList<>();
        for (MenuItem m : ordered) {
            if (isBeverage(m)) {
                bev.add(m);
            } else {
                food.add(m);
            }
        }
        List<MenuItem> out = new ArrayList<>(takeFirst(food, limit));
        if (out.size() < limit) {
            int need = limit - out.size();
            out.addAll(takeFirst(bev, need));
        }
        return out;
    }
}

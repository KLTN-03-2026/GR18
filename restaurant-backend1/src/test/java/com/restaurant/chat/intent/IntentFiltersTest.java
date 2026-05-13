package com.restaurant.chat.intent;

import com.restaurant.entity.Category;
import com.restaurant.entity.MenuItem;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho {@link IntentFilters}. Mục tiêu chính:
 * <ol>
 *   <li>"món ngọt" chỉ trả dessert, không trả bò/sushi/hàu.</li>
 *   <li>"món cay" chỉ trả món có keyword cay, KHÔNG trả kem/mochi.</li>
 *   <li>"món chay" KHÔNG trả "salad cá hồi" (cá là protein!).</li>
 *   <li>Sort theo price DESC/ASC ổn định.</li>
 *   <li>Diversify theo category.</li>
 * </ol>
 */
class IntentFiltersTest {

    // ============================================================
    // Test fixtures
    // ============================================================

    private static Category cat(long id, String name) {
        Category c = new Category();
        c.setId(id);
        c.setName(name);
        c.setIsActive(true);
        return c;
    }

    private static MenuItem item(long id, String name, String desc, Category c, int priceVnd, int sold, double rating) {
        return MenuItem.builder()
                .id(id)
                .name(name)
                .description(desc)
                .category(c)
                .price(BigDecimal.valueOf(priceVnd))
                .isActive(true)
                .isAvailable(true)
                .totalSold(sold)
                .avgRating(BigDecimal.valueOf(rating))
                .build();
    }

    private static List<MenuItem> samplePool() {
        Category mainCourse = cat(1, "Món chính");
        Category seafood    = cat(2, "Hải sản");
        Category sushi      = cat(3, "Sushi");
        Category dessert    = cat(4, "Tráng miệng");
        Category soup       = cat(5, "Lẩu");
        Category salad      = cat(6, "Salad");
        Category drinks     = cat(7, "Đồ uống");

        return List.of(
                item(1,  "Bò Wagyu áp chảo",   "Thịt bò Mỹ thượng hạng",  mainCourse, 590000, 12, 4.7),
                item(2,  "Hàu nướng phô mai",  "Hải sản hàu tươi",        seafood,    220000, 35, 4.6),
                item(3,  "Sushi cá hồi",       "Sashimi salmon tươi",     sushi,      180000, 60, 4.5),
                item(4,  "Tôm hùm sốt bơ tỏi", "Hải sản tôm hùm Canada",  seafood,    890000,  6, 4.9),

                item(5,  "Kem vani",           "Kem tươi vị vani",        dessert,     45000, 80, 4.3),
                item(6,  "Mochi đậu đỏ",       "Bánh dẻo nhân ngọt",      dessert,     35000, 70, 4.4),
                item(7,  "Tiramisu",           "Bánh ngọt Ý cà phê",      dessert,     65000, 50, 4.6),

                item(8,  "Lẩu thái tomyum",    "Lẩu cay chua kiểu Thái",  soup,       320000, 45, 4.5),
                item(9,  "Kimchi Hàn Quốc",    "Đồ chua cay lên men",     mainCourse,  55000, 25, 4.2),
                item(10, "Gà sốt cay",         "Gà chiên sốt ớt sa tế",   mainCourse, 130000, 40, 4.4),

                item(11, "Salad cá hồi",       "Salad rau với cá hồi",    salad,      150000, 30, 4.4),
                item(12, "Salad rau xanh",     "Salad rau củ thuần chay", salad,       60000, 20, 4.1),
                item(13, "Đậu hũ chiên giòn",  "Đậu hũ thuần chay",       mainCourse,  35000, 18, 4.0),
                item(14, "Nấm xào tỏi",        "Nấm rau củ áp chảo",      mainCourse,  55000, 15, 4.3),

                item(15, "Cà phê đen",         "Đồ uống đen đá",          drinks,      25000, 90, 4.5)
        );
    }

    // ============================================================
    // DESSERT
    // ============================================================

    @Test
    @DisplayName("filterDessert: chỉ trả món thuộc category Tráng miệng")
    void filterDessert_returnsOnlyDessertCategory() {
        List<MenuItem> dessert = IntentFilters.filterDessert(samplePool());

        assertThat(dessert).extracting(MenuItem::getName)
                .containsExactlyInAnyOrder("Kem vani", "Mochi đậu đỏ", "Tiramisu")
                .doesNotContain("Bò Wagyu áp chảo", "Hàu nướng phô mai", "Sushi cá hồi");
    }

    @Test
    @DisplayName("filterDessert (không có category dessert): rơi về keyword whitelist + bỏ bánh mặn")
    void filterDessert_keywordFallback_skipsSavoryBread() {
        Category main = cat(1, "Món chính");
        List<MenuItem> pool = List.of(
                item(1, "Bánh mì pate", "Bánh mì kẹp", main, 30000, 40, 4.3),
                item(2, "Bánh kem dâu",  "Bánh ngọt phủ kem", main, 80000, 35, 4.6),
                item(3, "Bò bít tết",    "Steak bò", main, 250000, 20, 4.5)
        );
        List<MenuItem> dessert = IntentFilters.filterDessert(pool);
        assertThat(dessert).extracting(MenuItem::getName).containsExactly("Bánh kem dâu");
    }

    // ============================================================
    // SPICY
    // ============================================================

    @Test
    @DisplayName("filterSpicy: KHÔNG trả kem/mochi, chỉ trả món có keyword cay/ớt/kimchi/sa tế")
    void filterSpicy_excludesNonSpicy() {
        List<MenuItem> spicy = IntentFilters.filterSpicy(samplePool());
        assertThat(spicy).extracting(MenuItem::getName)
                .contains("Lẩu thái tomyum", "Kimchi Hàn Quốc", "Gà sốt cay")
                .doesNotContain("Kem vani", "Mochi đậu đỏ", "Sushi cá hồi", "Bò Wagyu áp chảo");
    }

    @Test
    @DisplayName("filterSpicy: production-style data — mention 'không cay' trong desc bị loại")
    void filterSpicy_ignoresCasualMentionInDescription() {
        Category main = cat(1, "Món chính");
        Category dessert = cat(4, "Tráng miệng");
        Category sushi = cat(3, "Sushi");
        List<MenuItem> pool = List.of(
                // Wagyu — mô tả không chứa keyword spicy hợp lệ
                item(20, "Bò Wagyu áp chảo",
                        "Bò Mỹ A5 sốt rượu vang, kèm rau củ áp chảo, không cay.",
                        main, 1_299_000, 12, 4.7),
                // Kem vani — desc cao casual mention "cay" sau "không"
                item(21, "Kem vani Pháp",
                        "Kem tươi vị vani thanh mát, không cay, phù hợp trẻ em.",
                        dessert, 29_000, 80, 4.5),
                // Mochi
                item(22, "Mochi đậu đỏ",
                        "Bánh dẻo Nhật nhân ngọt đậu đỏ.",
                        dessert, 35_000, 70, 4.4),
                // Đây mới là món thật sự cay
                item(23, "Uramaki cá ngừ cay",
                        "Sushi cuộn ngược nhân cá ngừ, sốt cay nồng kèm wasabi.",
                        sushi, 285_000, 45, 4.6)
        );
        List<MenuItem> spicy = IntentFilters.filterSpicy(pool);
        assertThat(spicy).extracting(MenuItem::getName)
                .containsExactly("Uramaki cá ngừ cay")
                .doesNotContain("Bò Wagyu áp chảo", "Kem vani Pháp", "Mochi đậu đỏ");
    }

    @Test
    @DisplayName("filterSpicy: chỉ desc có compound 'sốt cay' / 'cay nồng' mới pass")
    void filterSpicy_descCompoundPhrasePass() {
        Category main = cat(1, "Món chính");
        List<MenuItem> pool = List.of(
                // Casual mention "cay" — KHÔNG pass
                item(30, "Gà chiên giòn", "Có thể chấm tương ớt nếu thích cay.", main, 90_000, 30, 4.2),
                // Compound rõ ràng — PASS
                item(31, "Mì xào hải sản", "Mì xào sốt cay nồng kiểu Tứ Xuyên.", main, 95_000, 25, 4.3),
                // Đã có "cay" trong NAME — PASS
                item(32, "Lẩu thái cay", "Lẩu nóng.", main, 350_000, 40, 4.6)
        );
        List<MenuItem> spicy = IntentFilters.filterSpicy(pool);
        assertThat(spicy).extracting(MenuItem::getName)
                .containsExactlyInAnyOrder("Mì xào hải sản", "Lẩu thái cay")
                .doesNotContain("Gà chiên giòn");
    }

    // ============================================================
    // VEGETARIAN
    // ============================================================

    @Test
    @DisplayName("filterVegetarian: KHÔNG trả 'Salad cá hồi' (cá = protein)")
    void filterVegetarian_rejectsSalmonSalad() {
        List<MenuItem> chay = IntentFilters.filterVegetarian(samplePool());

        assertThat(chay).extracting(MenuItem::getName)
                .doesNotContain("Salad cá hồi")    // cá hồi -> bị loại
                .doesNotContain("Bò Wagyu áp chảo", "Hàu nướng phô mai", "Sushi cá hồi",
                        "Tôm hùm sốt bơ tỏi", "Gà sốt cay");
    }

    @Test
    @DisplayName("filterVegetarian: ưu tiên món có whitelist signal (chay/đậu hũ/nấm/rau)")
    void filterVegetarian_prefersWhitelistSignal() {
        List<MenuItem> chay = IntentFilters.filterVegetarian(samplePool());

        assertThat(chay).extracting(MenuItem::getName)
                .contains("Salad rau xanh", "Đậu hũ chiên giòn", "Nấm xào tỏi");
    }

    // ============================================================
    // PRICE — DESC / ASC
    // ============================================================

    @Test
    @DisplayName("sortPriceDesc: món đắt nhất xuất hiện đầu tiên")
    void sortPriceDesc_topIsMostExpensive() {
        List<MenuItem> sorted = IntentFilters.sortPriceDesc(samplePool());
        assertThat(sorted.get(0).getName()).isEqualTo("Tôm hùm sốt bơ tỏi"); // 890k
        assertThat(sorted.get(1).getName()).isEqualTo("Bò Wagyu áp chảo");   // 590k
    }

    @Test
    @DisplayName("sortPriceAsc: món rẻ nhất xuất hiện đầu tiên")
    void sortPriceAsc_topIsCheapest() {
        List<MenuItem> sorted = IntentFilters.sortPriceAsc(samplePool());
        assertThat(sorted.get(0).getName()).isEqualTo("Cà phê đen"); // 25k
    }

    @Test
    @DisplayName("filterByMaxPrice: bỏ mọi món > cap")
    void filterByMaxPrice_strict() {
        List<MenuItem> within = IntentFilters.filterByMaxPrice(samplePool(), 100_000);
        assertThat(within).extracting(MenuItem::getName)
                .doesNotContain("Tôm hùm sốt bơ tỏi", "Bò Wagyu áp chảo", "Lẩu thái tomyum");
    }

    // ============================================================
    // DIVERSIFY
    // ============================================================

    @Test
    @DisplayName("diversifyByCategory: tối đa N món / category")
    void diversifyByCategory_limitsPerCategory() {
        List<MenuItem> ordered = samplePool();
        List<MenuItem> diverse = IntentFilters.diversifyByCategory(ordered, 5, 1);

        assertThat(diverse).hasSize(5);
        long distinctCats = diverse.stream()
                .map(m -> m.getCategory().getId())
                .distinct()
                .count();
        assertThat(distinctCats).isEqualTo(5);
    }

    // ============================================================
    // SEAFOOD / MEAT / SUSHI
    // ============================================================

    @Test
    @DisplayName("filterSeafood: phải có keyword hải sản/tôm/cua/cá hồi…")
    void filterSeafood_picksSeafood() {
        List<MenuItem> seafood = IntentFilters.filterSeafood(samplePool());
        assertThat(seafood).extracting(MenuItem::getName)
                .contains("Hàu nướng phô mai", "Tôm hùm sốt bơ tỏi", "Sushi cá hồi", "Salad cá hồi");
    }

    @Test
    @DisplayName("filterMeatFocused: chỉ món thịt chính, không tính sushi/há cảo")
    void filterMeatFocused_picksMeat() {
        List<MenuItem> meat = IntentFilters.filterMeatFocused(samplePool());
        assertThat(meat).extracting(MenuItem::getName)
                .contains("Bò Wagyu áp chảo")
                .doesNotContain("Sushi cá hồi", "Kem vani");
    }

    @Test
    @DisplayName("filterSushi: chỉ trả sushi/sashimi/maki/nigiri")
    void filterSushi_strict() {
        List<MenuItem> sushi = IntentFilters.filterSushi(samplePool());
        assertThat(sushi).extracting(MenuItem::getName).containsExactly("Sushi cá hồi");
    }

    // ============================================================
    // FOOD vs BEVERAGE — split filters
    // ============================================================

    /** Pool mô phỏng nhà hàng có nhiều đồ uống giá rẻ — kịch bản "món rẻ → Coca/Pepsi". */
    private static List<MenuItem> foodBeveragePool() {
        Category mainCourse = cat(1, "Món chính");
        Category dessert    = cat(4, "Tráng miệng");
        Category drinks     = cat(7, "Đồ uống");

        return List.of(
                // FOOD
                item(100, "Bún chả Hà Nội",  "Bún chả truyền thống",   mainCourse,  65000, 80, 4.5),
                item(101, "Cơm gà xối mỡ",   "Cơm gà giòn",             mainCourse,  75000, 90, 4.4),
                item(102, "Mì xào hải sản",  "Mì xào sốt cay nhẹ",      mainCourse,  95000, 60, 4.3),
                item(103, "Bò Wagyu áp chảo","Thịt bò Mỹ",              mainCourse, 590000, 12, 4.7),
                item(104, "Bánh flan",       "Bánh flan",               dessert,     25000, 50, 4.2),
                // BEVERAGES (rẻ — "Coca/Pepsi/Nước suối/7Up" — kịch bản user phàn nàn)
                item(200, "Nước suối",       "Nước tinh khiết 500ml",   drinks,      10000, 200, 4.5),
                item(201, "Coca-Cola",       "Lon 330ml",               drinks,      18000, 180, 4.4),
                item(202, "Pepsi",           "Lon 330ml",               drinks,      18000, 150, 4.3),
                item(203, "7Up",             "Lon 330ml",               drinks,      18000, 120, 4.2),
                item(204, "Cà phê đen",      "Cafe đen đá",             drinks,      25000, 90, 4.5)
        );
    }

    @Test
    @DisplayName("excludeBeverages: loại bỏ Coca/Pepsi/Nước suối khỏi pool")
    void excludeBeverages_dropsAllDrinks() {
        List<MenuItem> food = IntentFilters.excludeBeverages(foodBeveragePool());
        assertThat(food).extracting(MenuItem::getName)
                .contains("Bún chả Hà Nội", "Cơm gà xối mỡ", "Bánh flan")
                .doesNotContain("Nước suối", "Coca-Cola", "Pepsi", "7Up", "Cà phê đen");
    }

    @Test
    @DisplayName("onlyBeverages: chỉ giữ đồ uống")
    void onlyBeverages_keepsDrinksOnly() {
        List<MenuItem> bev = IntentFilters.onlyBeverages(foodBeveragePool());
        assertThat(bev).extracting(MenuItem::getName)
                .containsExactlyInAnyOrder("Nước suối", "Coca-Cola", "Pepsi", "7Up", "Cà phê đen");
    }

    @Test
    @DisplayName("CHEAPEST 'món ăn rẻ nhất' — KHÔNG được trả Coca/Pepsi ở top")
    void cheapest_foodIntent_excludesBeverages() {
        String msg = "món ăn rẻ nhất";
        // Mô phỏng quyết định business của handleCheapest
        assertThat(IntentMatcher.shouldExcludeBeverages(ChatIntent.CHEAPEST, msg)).isTrue();

        List<MenuItem> food = IntentFilters.excludeBeverages(foodBeveragePool());
        List<MenuItem> sorted = IntentFilters.sortPriceAsc(food);
        List<MenuItem> top = IntentFilters.takeFirst(sorted, 5);

        assertThat(top).extracting(MenuItem::getName)
                .doesNotContain("Nước suối", "Coca-Cola", "Pepsi", "7Up", "Cà phê đen");
        // Phải có món rẻ (Bánh flan 25k đứng đầu food sau khi sort ASC)
        assertThat(top.get(0).getName()).isEqualTo("Bánh flan");
    }

    @Test
    @DisplayName("CHEAPEST 'đồ uống rẻ nhất' — được phép trả Coca/Pepsi/Nước suối")
    void cheapest_beverageIntent_keepsBeverages() {
        String msg = "đồ uống rẻ nhất";
        assertThat(IntentMatcher.shouldExcludeBeverages(ChatIntent.CHEAPEST, msg)).isFalse();
        assertThat(IntentMatcher.isBeverageIntent(msg)).isTrue();

        List<MenuItem> bev = IntentFilters.onlyBeverages(foodBeveragePool());
        List<MenuItem> sorted = IntentFilters.sortPriceAsc(bev);
        List<MenuItem> top = IntentFilters.takeFirst(sorted, 5);

        assertThat(top.get(0).getName()).isEqualTo("Nước suối"); // 10k
        assertThat(top).extracting(MenuItem::getName)
                .contains("Coca-Cola", "Pepsi", "7Up");
    }

    @Test
    @DisplayName("BUDGET 'món dưới 80k' — chỉ trả food, KHÔNG có Coca/Pepsi")
    void budget_foodIntent_excludesBeverages() {
        String msg = "món dưới 80k";
        assertThat(IntentMatcher.shouldExcludeBeverages(ChatIntent.BUDGET, msg)).isTrue();

        List<MenuItem> within = IntentFilters.filterByMaxPrice(foodBeveragePool(), 80_000);
        // ưu tiên food-first
        List<MenuItem> picks = IntentFilters.foodFirstThenBeverages(
                IntentFilters.sortPriceAsc(IntentFilters.excludeBeverages(within)),
                5);

        assertThat(picks).extracting(MenuItem::getName)
                .doesNotContain("Nước suối", "Coca-Cola", "Pepsi", "7Up", "Cà phê đen")
                .contains("Bún chả Hà Nội", "Cơm gà xối mỡ", "Bánh flan");
    }

    @Test
    @DisplayName("BUDGET 'nước rẻ' — flow beverage, không trả món ăn")
    void budget_beverageIntent_keepsBeverages() {
        String msg = "nước rẻ";
        assertThat(IntentMatcher.shouldExcludeBeverages(ChatIntent.BUDGET, msg)).isFalse();
        assertThat(IntentMatcher.isBeverageIntent(msg)).isTrue();

        List<MenuItem> within = IntentFilters.filterByMaxPrice(foodBeveragePool(), 30_000);
        List<MenuItem> bev = IntentFilters.onlyBeverages(within);
        List<MenuItem> sorted = IntentFilters.sortPriceAsc(bev);

        assertThat(sorted).extracting(MenuItem::getName)
                .contains("Nước suối", "Coca-Cola", "Pepsi", "7Up", "Cà phê đen")
                .doesNotContain("Bún chả Hà Nội", "Cơm gà xối mỡ");
    }

    @Test
    @DisplayName("foodFirstThenBeverages: đủ food → không điền beverage; thiếu → điền cuối")
    void foodFirstThenBeverages_fillsOnlyIfShort() {
        Category main = cat(1, "Món chính");
        Category drinks = cat(7, "Đồ uống");
        List<MenuItem> ordered = List.of(
                item(1, "Bánh flan",       "", main,   25000, 0, 0),
                item(2, "Cơm gà",          "", main,   75000, 0, 0),
                item(3, "Nước suối",       "", drinks, 10000, 0, 0),
                item(4, "Coca",            "", drinks, 18000, 0, 0)
        );

        // Limit 5, food chỉ 2 món → cần điền beverage
        List<MenuItem> picks5 = IntentFilters.foodFirstThenBeverages(ordered, 5);
        assertThat(picks5).extracting(MenuItem::getName)
                .containsExactly("Bánh flan", "Cơm gà", "Nước suối", "Coca");

        // Limit 2, food đã đủ → không điền beverage
        List<MenuItem> picks2 = IntentFilters.foodFirstThenBeverages(ordered, 2);
        assertThat(picks2).extracting(MenuItem::getName)
                .containsExactly("Bánh flan", "Cơm gà")
                .doesNotContain("Nước suối", "Coca");
    }
}

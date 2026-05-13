package com.restaurant.menu;

import java.util.List;

/**
 * Tập keyword dùng chung cho chatbot. Tách khỏi {@link com.restaurant.service.ChatMenuAssistant}
 * để dễ unit test các bộ lọc intent (ngọt / cay / chay / hải sản / thịt / sushi …)
 * mà không cần Spring context hay DB.
 *
 * <p><b>Quy ước:</b> tất cả keyword đều LOWER-CASE. Khi so khớp, hãy normalize chuỗi
 * cần so khớp về lower-case rồi {@code .contains(keyword)}.
 */
public final class MenuKeywords {

    private MenuKeywords() {
    }

    /**
     * Protein / hải sản — blacklist cho intent CHAY.
     *
     * <p><b>Lưu ý:</b> tránh các đơn âm có thể substring-match vào từ vô hại
     * (vd. KHÔNG được liệt kê <code>"giò"</code> vì sẽ trùng <code>"giòn"</code>;
     * KHÔNG <code>"hồi"</code> vì trùng <code>"hồi tưởng"</code>).
     * Khi cần, hãy dùng dạng cụm cụ thể như <code>"giò lụa"</code>, <code>"cá hồi"</code>…
     */
    public static final List<String> NON_VEGETARIAN_BLACKLIST = List.of(
            // Thịt đỏ / trắng
            "bò", "wagyu", "beef", "steak", "bít tết",
            "heo", "pork", "ba chỉ", "ba rọi", "sườn", "thăn", "dăm bông",
            "gà", "chicken", "vịt", "duck",
            "cừu", "lamb",
            "lươn", "ếch", "thỏ",
            "thịt", "xúc xích", "lạp xưởng", "jambon", "bacon",
            "giò lụa", "giò chả", "giò heo", "chân giò", "giò sống",
            // Cá — "cá" đã bắt phần lớn dạng "cá X". Thêm các tên tiếng Anh phổ biến.
            "cá", "salmon", "tuna",
            // Hải sản
            "tôm", "shrimp", "prawn",
            "cua", "crab", "ghẹ",
            "mực", "squid", "octopus", "bạch tuộc",
            "sò", "ngao", "hàu", "oyster", "scallop",
            "hải sản", "seafood",
            // Sushi / sashimi mặc định chứa cá sống
            "sushi", "sashimi", "maki", "nigiri", "uni"
    );

    /** Tín hiệu dương cho CHAY (whitelist). */
    public static final List<String> VEGETARIAN_WHITELIST = List.of(
            "chay", "vegan", "vegetarian", "thuần chay",
            "đậu hũ", "tofu", "đậu phụ",
            "nấm", "mushroom",
            "rau củ", "rau xào", "rau luộc",
            "salad rau", "gỏi chay"
    );

    /**
     * Tín hiệu CAY trong <b>name</b> — keyword đứng độc lập đủ để khẳng định
     * "đây là món cay". Match đơn giản bằng {@code contains}.
     *
     * <p>QUAN TRỌNG: Chỉ match trên NAME để giảm false-positive. Description thường
     * chứa cụm casual như "ăn không cay được" → không tin được.
     */
    public static final List<String> SPICY_NAME_KEYS = List.of(
            "cay", "ớt", "kimchi", "sa tế", "spicy",
            "lẩu thái", "tom yum", "tom yam", "tomyum",
            "mala", "tê cay", "chilli", "chili"
    );

    /**
     * Tín hiệu CAY trong <b>description</b> — bắt buộc dạng cụm/compound để
     * đảm bảo người viết có chủ đích nói món này cay (chứ không phải đề cập thoáng qua).
     */
    public static final List<String> SPICY_DESC_COMPOUNDS = List.of(
            "vị cay", "sốt cay", "ướp cay",
            "cay nồng", "cay đậm", "cay xé", "cay tê",
            "siêu cay", "rất cay", "hơi cay nồng",
            "ớt sa tế", "ớt khô", "ớt bột", "tương ớt cay",
            "kimchi", "sa tế"
    );

    /**
     * Tín hiệu PHỦ ĐỊNH cay — bất kỳ cụm nào xuất hiện đều khẳng định món KHÔNG cay,
     * dù trên name hay description.
     */
    public static final List<String> SPICY_NEGATION = List.of(
            "không cay", "ko cay", "ít cay", "it cay",
            "không quá cay", "không bị cay", "không có ớt", "không ớt",
            "không vị cay", "no spicy", "not spicy", "mild",
            "phù hợp trẻ em", "trẻ em vẫn ăn được"
    );

    /**
     * Tín hiệu NGỌT trong <b>name</b> — đủ mạnh để khẳng định món tráng miệng/ngọt.
     * Tách khỏi description để tránh "vị ngọt thanh" trong mô tả món mặn.
     */
    public static final List<String> DESSERT_NAME_KEYS = List.of(
            "tráng miệng", "dessert",
            "kem", "ice cream", "gelato", "sorbet",
            "mochi", "dango",
            "bánh kem", "bánh ngọt", "bánh flan", "bánh bông lan",
            "tiramisu", "panna cotta", "pudding",
            "cheesecake", "cupcake", "macaron", "tart", "pie", "brownie", "donut",
            "chè", "yaourt", "sữa chua", "yogurt",
            "kẹo"
    );

    /** (Giữ tương thích cũ.) Đã được {@link #DESSERT_NAME_KEYS} thay thế. */
    @Deprecated
    public static final List<String> DESSERT_WHITELIST = DESSERT_NAME_KEYS;

    /** (Giữ tương thích cũ.) Đã được {@link #SPICY_NAME_KEYS} thay thế. */
    @Deprecated
    public static final List<String> SPICY_WHITELIST = SPICY_NAME_KEYS;

    /**
     * Các "bánh" KHÔNG ngọt — tránh false-positive khi gặp keyword "bánh".
     * Ví dụ: bánh mì, bánh xèo, bánh cuốn, bánh canh… là món mặn.
     */
    public static final List<String> DESSERT_BLACKLIST = List.of(
            "bánh mì", "banh mi",
            "bánh xèo", "banh xeo",
            "bánh cuốn", "banh cuon",
            "bánh canh", "banh canh",
            "bánh tráng", "banh trang",
            "bánh bao", "banh bao",
            "bánh hỏi", "banh hoi",
            "bánh khọt", "banh khot",
            "bánh ướt", "banh uot",
            "bánh đa", "banh da"
    );

    /** Tín hiệu hải sản. */
    public static final List<String> SEAFOOD_KEYWORDS = List.of(
            "hải sản", "hai san", "seafood",
            "tôm", "cua", "ghẹ", "mực", "sò", "ngao", "hàu", "ốc",
            "cá hồi", "salmon", "cá ngừ", "tuna", "bạch tuộc"
    );

    /** Tín hiệu món thịt (chú trọng món thịt chính, không tính nhân nhồi). */
    public static final List<String> MEAT_KEYWORDS = List.of(
            "thịt", "bò", "heo", "cừu", "wagyu", "beef", "pork", "lamb",
            "steak", "bít tết", "sườn", "ba chỉ", "ba rọi", "thăn"
    );

    /** Snack vỏ bột nhồi nhân — bỏ khỏi nhóm "món thịt" dù có keyword thịt. */
    public static final List<String> DUMPLING_BLACKLIST = List.of(
            "gyoza", "bánh xếp", "banh xep",
            "há cảo", "ha cao",
            "hoành thánh", "hoanh thanh",
            "dumpling", "dim sum", "dimsum",
            "xiao long", "xiaolong",
            "mandu", "potsticker", "wonton",
            "sủi cảo", "sui cao"
    );

    /** Sushi/sashimi nhánh riêng. */
    public static final List<String> SUSHI_KEYWORDS = List.of(
            "sushi", "sashimi", "maki", "nigiri", "uramaki", "temaki"
    );

    /** Gợi ý món ăn nhẹ / healthy. */
    public static final List<String> HEALTHY_KEYWORDS = List.of(
            "salad", "rau", "healthy", "luộc", "hấp", "ít dầu", "light",
            "ăn kiêng", "low calorie", "low fat"
    );

    /** Loại trừ healthy "giả" (vd. salad cá hồi vẫn có protein). Không áp dụng tự động. */
    public static final List<String> COMMON_VIETNAMESE_DIACRITICS_MARKER = List.of();
}

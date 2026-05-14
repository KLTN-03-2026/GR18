package com.restaurant.chat.intent;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Bộ luật phân loại intent thuần (không dùng DB/Spring). Mục tiêu:
 * <ol>
 *   <li>Tách rõ ràng một câu hỏi của khách thuộc intent nào.</li>
 *   <li>Đảm bảo các intent khác nhau KHÔNG cùng rơi vào một nhánh trả lời.</li>
 * </ol>
 *
 * <p>Quy ước input: tham số {@code msg} đã được lower-case (theo
 * {@code Locale.ROOT}). Hàm trả về {@link ChatIntent} duy nhất theo thứ tự ưu tiên
 * khai báo trong enum.
 */
public final class IntentMatcher {

    private IntentMatcher() {
    }

    private static final Pattern N_PEOPLE = Pattern.compile("(?s).*\\d+\\s*người.*");

    public static ChatIntent detect(String msgRaw) {
        if (msgRaw == null) {
            return ChatIntent.UNKNOWN;
        }
        String msg = msgRaw.toLowerCase(Locale.ROOT).trim();
        if (msg.isEmpty()) {
            return ChatIntent.UNKNOWN;
        }

        if (msg.contains("đặt bàn") || msg.contains("dat ban") || msg.contains("đặt chỗ")) {
            return ChatIntent.BOOKING;
        }

        if (isStandaloneGreeting(msg)) {
            return ChatIntent.GREETING;
        }

        // CHAY ưu tiên trước các intent food khác vì có thể chứa từ "rau", "salad" gây nhầm
        if (isVegetarianIntent(msg)) {
            return ChatIntent.VEGETARIAN;
        }

        // DESSERT (ngọt / tráng miệng) — cần ưu tiên cao để không bị "món ngon" cướp
        if (isDessertIntent(msg)) {
            return ChatIntent.DESSERT;
        }

        if (isSpicyIntent(msg)) {
            return ChatIntent.SPICY;
        }

        if (isMostExpensiveIntent(msg)) {
            return ChatIntent.MOST_EXPENSIVE;
        }
        if (isCheapestIntent(msg)) {
            return ChatIntent.CHEAPEST;
        }
        if (isBudgetIntent(msg)) {
            return ChatIntent.BUDGET;
        }

        if (isTopSellingIntent(msg)) {
            return ChatIntent.TOP_SELLING;
        }
        if (isTopRatedIntent(msg)) {
            return ChatIntent.TOP_RATED;
        }
        if (isLowRatedIntent(msg)) {
            return ChatIntent.LOW_RATED;
        }

        if (isSushiIntent(msg)) {
            return ChatIntent.SUSHI;
        }
        if (isSeafoodIntent(msg)) {
            return ChatIntent.SEAFOOD;
        }
        if (isMeatIntent(msg)) {
            return ChatIntent.MEAT;
        }
        if (isHealthyIntent(msg)) {
            return ChatIntent.HEALTHY;
        }

        if (isSignatureIntent(msg)) {
            return ChatIntent.SIGNATURE;
        }
        if (isMenuOverviewIntent(msg)) {
            return ChatIntent.MENU_OVERVIEW;
        }

        if (isCasualPopularIntent(msg)) {
            return ChatIntent.POPULAR_FALLBACK;
        }

        return ChatIntent.UNKNOWN;
    }

    // ============================== INTENT RULES ==============================

    public static boolean isStandaloneGreeting(String msg) {
        if (msg.length() > 56) {
            return false;
        }
        if (msg.contains("menu") || msg.contains("món") || msg.contains("đặt") || msg.contains("booking")) {
            return false;
        }
        return msg.matches("^(xin\\s+chào|chào(\\s+(bạn|em|anh|chị))?|hello|hi|hey)([!?.\\s]*)$")
                || msg.matches("^chào[!?.\\s]*$");
    }

    /** Trigger: ngọt / tráng miệng / dessert / kem / mochi / chè / bánh ngọt … */
    public static boolean isDessertIntent(String msg) {
        if (msg.contains("không ngọt") || msg.contains("ít ngọt")) {
            return false;
        }
        return msg.contains("tráng miệng")
                || msg.contains("dessert")
                || msg.contains("món ngọt") || msg.contains("ngọt nào") || msg.contains("đồ ngọt")
                || msg.contains(" kem ") || msg.endsWith(" kem") || msg.startsWith("kem")
                || msg.contains("ice cream")
                || msg.contains("mochi") || msg.contains("dango")
                || msg.contains("bánh ngọt") || msg.contains("bánh kem")
                || msg.contains("tiramisu") || msg.contains("cheesecake") || msg.contains("panna")
                || msg.contains("pudding") || msg.contains("chè ") || msg.contains(" chè")
                || msg.contains("yaourt") || msg.contains("sữa chua")
                || msg.equals("ngọt") || msg.equals("đồ tráng miệng");
    }

    /** Trigger: cay / ớt / sa tế / kimchi / spicy. */
    public static boolean isSpicyIntent(String msg) {
        for (String neg : com.restaurant.menu.MenuKeywords.SPICY_NEGATION) {
            if (msg.contains(neg)) {
                return false;
            }
        }
        return msg.contains("cay") || msg.contains("ớt")
                || msg.contains("sa tế") || msg.contains("sate")
                || msg.contains("kimchi") || msg.contains("spicy") || msg.contains("chili")
                || msg.contains("mala") || msg.contains("tê cay");
    }

    /** Trigger: chay / vegan / vegetarian. */
    public static boolean isVegetarianIntent(String msg) {
        return msg.contains("ăn chay") || msg.contains("đồ chay") || msg.contains("món chay")
                || msg.contains("vegan") || msg.contains("vegetarian") || msg.contains("thuần chay")
                || msg.equals("chay") || msg.equals("đồ chay");
    }

    public static boolean isMostExpensiveIntent(String msg) {
        if (msg.contains("không đắt") || msg.contains("hong đắt") || msg.contains("hổng đắt")) {
            return false;
        }
        return msg.contains("đắt nhất") || msg.contains("mắc nhất") || msg.contains("đắt tiền nhất")
                || msg.contains("đắt tiền")
                || msg.contains("top đắt") || msg.contains("giá cao nhất")
                || (msg.contains("giá") && msg.contains("cao nhất"))
                || msg.matches("(?s).*món[^.!?]{0,24}(đắt|mắc)[^.!?]{0,14}nhất.*");
    }

    public static boolean isCheapestIntent(String msg) {
        return msg.contains("rẻ nhất") || msg.contains("rẽ nhất")
                || msg.contains("giá thấp nhất")
                || msg.matches("(?s).*rẻ[^.!?]{0,10}nhất.*");
    }

    public static boolean isBudgetIntent(String msg) {
        if (isCheapestIntent(msg)) {
            return false;
        }
        // Khách nêu khoảng giá rõ ràng (>, <, dưới, trên, "từ A đến B"…) → BUDGET.
        if (!extractPriceFilter(msg).isEmpty()) {
            return true;
        }
        return msg.contains("rẻ") || msg.contains("tiết kiệm") || msg.contains("sinh viên")
                || msg.contains("túi tiền") || msg.contains("ngân sách")
                || msg.contains("budget");
    }

    public static boolean isTopSellingIntent(String msg) {
        return msg.contains("bán chạy")
                || msg.contains("best seller") || msg.contains("bestseller")
                || msg.contains("top bán") || msg.contains("top gọi")
                || msg.contains("gọi nhiều nhất") || msg.contains("đặt nhiều nhất")
                || msg.contains("được gọi nhiều")
                || msg.contains("hay gọi") || msg.contains("thường gọi") || msg.contains("order nhiều")
                || (msg.contains("nhiều người") && msg.contains("gọi"));
    }

    public static boolean isTopRatedIntent(String msg) {
        if (msg.contains("rating thấp") || msg.contains("điểm thấp") || msg.contains("đánh giá thấp")) {
            return false;
        }
        return msg.contains("đánh giá cao") || msg.contains("rating cao")
                || msg.contains("review hay") || msg.contains("review tốt")
                || msg.contains("điểm cao") || msg.contains("5 sao")
                || msg.contains("được khen") || msg.contains("khen nhiều")
                || (msg.contains("rating") && !msg.contains("thấp"));
    }

    public static boolean isLowRatedIntent(String msg) {
        if (msg.contains("không thấp") || msg.contains("không bị chê")) {
            return false;
        }
        return msg.contains("đánh giá thấp") || msg.contains("rating thấp")
                || msg.contains("review thấp") || msg.contains("điểm thấp")
                || msg.contains("bị chê") || msg.contains("chê nhiều") || msg.contains("chê nhất")
                || msg.contains("tệ nhất") || msg.contains("nên tránh");
    }

    public static boolean isSushiIntent(String msg) {
        boolean topic = msg.contains("sushi") || msg.contains("sashimi")
                || msg.contains("maki") || msg.contains("nigiri");
        return topic;
    }

    public static boolean isSeafoodIntent(String msg) {
        return msg.contains("hải sản") || msg.contains("hai san") || msg.contains("hải san")
                || msg.contains("seafood");
    }

    public static boolean isMeatIntent(String msg) {
        if (msg.contains("ăn chay") || msg.contains("món chay") || msg.contains("đồ chay")) {
            return false;
        }
        boolean topic = msg.contains("món thịt") || msg.contains("thịt nào")
                || (msg.contains("thịt") && (msg.contains("ngon") || msg.contains("gợi ý")
                || msg.contains("có gì") || msg.contains("nên gọi") || msg.contains("recommend")))
                || msg.contains("steak") || msg.contains("bít tết")
                || msg.contains("sườn heo") || msg.contains("ba chỉ") || msg.contains("ba rọi")
                || msg.contains("wagyu");
        return topic;
    }

    public static boolean isHealthyIntent(String msg) {
        return msg.contains("healthy") || msg.contains("ít dầu") || msg.contains("ít calo")
                || msg.contains("ăn kiêng") || msg.contains("gym") || msg.contains("fitness")
                || msg.contains("low calorie") || msg.contains("ăn nhẹ");
    }

    // ============================================================
    // FOOD vs BEVERAGE — context detection (dùng cho CHEAPEST/BUDGET)
    // ============================================================

    /**
     * Khách đang nói tới <b>món ăn</b> (không phải đồ uống).
     * <ul>
     *   <li>Match: "món", "đồ ăn", "thức ăn", "ăn"</li>
     *   <li>Không tự động đúng cho câu chỉ có "rẻ nhất" — caller sẽ kết hợp với
     *       {@link #shouldExcludeBeverages(ChatIntent, String)}.</li>
     * </ul>
     */
    public static boolean isFoodIntent(String msg) {
        if (msg == null) {
            return false;
        }
        String m = msg.toLowerCase(Locale.ROOT).trim();
        if (m.isEmpty()) {
            return false;
        }
        return m.contains("món")
                || m.contains("đồ ăn") || m.contains("do an")
                || m.contains("thức ăn") || m.contains("thuc an")
                || m.contains(" ăn") || m.startsWith("ăn") || m.endsWith("ăn")
                || m.contains("đói")
                || m.contains("food") || m.contains("dish");
    }

    /**
     * Khách đang nói tới <b>đồ uống</b>.
     * Match: "đồ uống / thức uống / nước uống / nước / uống / drink / beverage / cà phê /
     * trà / sinh tố / coca / pepsi / 7up …
     */
    public static boolean isBeverageIntent(String msg) {
        if (msg == null) {
            return false;
        }
        String m = msg.toLowerCase(Locale.ROOT).trim();
        if (m.isEmpty()) {
            return false;
        }
        return m.contains("đồ uống") || m.contains("do uong")
                || m.contains("thức uống") || m.contains("thuc uong")
                || m.contains("nước uống") || m.contains("nuoc uong")
                || m.contains("uống") || m.contains("uong")
                || m.contains("nước ") || m.equals("nước") || m.endsWith(" nước")
                || m.contains("drink") || m.contains("beverage")
                || m.contains("cà phê") || m.contains("ca phe") || m.contains("cafe") || m.contains("coffee")
                || m.contains("trà ") || m.equals("trà") || m.contains(" tea") || m.startsWith("tea")
                || m.contains("sinh tố") || m.contains("sinh to")
                || m.contains("juice") || m.contains("smoothie")
                || m.contains("coca") || m.contains("pepsi") || m.contains("7up") || m.contains("sting")
                || m.contains("nước ngọt") || m.contains("nuoc ngot")
                || m.contains("nước suối") || m.contains("nuoc suoi");
    }

    /**
     * Có nên loại đồ uống ra khỏi pool gợi ý không?
     *
     * <p>Quy tắc:
     * <ol>
     *   <li>User <b>explicit</b> hỏi đồ uống (vd. "nước rẻ", "đồ uống dưới 30k") → giữ beverage.</li>
     *   <li>User <b>explicit</b> hỏi món ăn (vd. "món rẻ", "thức ăn dưới 80k") → loại beverage.</li>
     *   <li>Trường hợp mơ hồ ("rẻ nhất", "dưới 50k") — với intent CHEAPEST/BUDGET, mặc định
     *       <b>ưu tiên food</b> vì khách hỏi giá rẻ thường mong món no bụng, không phải nước ngọt.</li>
     * </ol>
     */
    public static boolean shouldExcludeBeverages(ChatIntent intent, String msg) {
        if (msg == null) {
            return false;
        }
        boolean foodHint = isFoodIntent(msg);
        boolean beverageHint = isBeverageIntent(msg);

        if (beverageHint && !foodHint) {
            return false; // explicit beverage → giữ đồ uống
        }
        if (foodHint && !beverageHint) {
            return true; // explicit food → loại beverage
        }
        // Mơ hồ — chỉ default loại beverage cho intent giá rẻ
        return intent == ChatIntent.CHEAPEST || intent == ChatIntent.BUDGET;
    }

    public static boolean isSignatureIntent(String msg) {
        return msg.contains("signature") || msg.contains("đặc trưng") || msg.contains("nổi bật")
                || msg.contains("hot trend") || msg.contains("chuẩn quán") || msg.contains("đặc sản");
    }

    public static boolean isMenuOverviewIntent(String msg) {
        if (msg.contains("menu online") || msg.contains("combo không") || msg.contains("combo nhóm")) {
            return true;
        }
        boolean noun = msg.contains("menu ") || msg.contains("thực đơn") || msg.contains("xem menu");
        boolean qa = msg.contains("có gì") || msg.contains("những gì") || msg.contains("bao nhiêu loại")
                || msg.contains("loại món") || msg.contains("đầy đủ") || msg.contains("có những");
        if (noun && qa) {
            return true;
        }
        return msg.startsWith("menu ") || msg.equals("menu") || msg.contains("menu nhà có")
                || msg.contains("cho mình xem menu");
    }

    /** Câu hỏi “đói / ăn gì / gợi ý / món ngon” — không khớp intent đặc thù. */
    public static boolean isCasualPopularIntent(String msg) {
        return msg.contains("đói") || msg.contains("ăn gì") || msg.contains("có gì ngon")
                || msg.contains("gợi ý món") || msg.contains("gợi ý đi") || msg.contains("recommend")
                || msg.contains("món ngon") || msg.contains("nên gọi món gì")
                || msg.contains("lạ lạ") || msg.contains("hay ho");
    }

    /**
     * Sử dụng cho intent BUDGET — trích mức giá tối đa từ câu.
     * Giữ lại để tương thích ngược; nội bộ delegate sang {@link #extractPriceFilter(String)}.
     */
    public static java.util.Optional<Integer> extractPriceCapVnd(String msg) {
        PriceFilter f = extractPriceFilter(msg);
        return f.hasMax() ? java.util.Optional.of(f.maxVnd()) : java.util.Optional.empty();
    }

    /**
     * Trích khoảng giá từ câu chat. Hỗ trợ:
     * <ul>
     *   <li>"từ 50k đến 100k" / "50k - 100k" / "khoảng 50-100k" → range</li>
     *   <li>"dưới 100k" / "không quá 100k" / "&lt;100" / "&lt;= 100k" / "tối đa 100k" → max only</li>
     *   <li>"trên 100k" / "hơn 100k" / "&gt;100" / "&gt;= 100k" / "tối thiểu 100k"
     *       / "100k trở lên" → min only</li>
     *   <li>"dưới 50000" / "trên 200000" (VND nguyên) → max/min</li>
     * </ul>
     * Quy ước số: có hậu tố "k"/"K" hoặc giá trị &lt; 1000 → coi là nghìn đồng (×1000).
     */
    public static PriceFilter extractPriceFilter(String msgRaw) {
        if (msgRaw == null || msgRaw.isBlank()) {
            return PriceFilter.NONE;
        }
        String msg = msgRaw.toLowerCase(Locale.ROOT);

        // 1) Range "A - B" / "A đến B" / "từ A đến B".
        //    Yêu cầu ÍT NHẤT một số có hậu tố "k" hoặc cả hai số đều ≥ 1000 (VND nguyên)
        //    để tránh nhầm với "7-9 người", "4-5 chỗ", "2 đến 3 ly".
        java.util.regex.Matcher range = java.util.regex.Pattern
                .compile("(\\d+)\\s*([kK]?)\\s*(?:-|–|—|đến|den|tới|toi|~)\\s*(\\d+)\\s*([kK]?)")
                .matcher(msg);
        if (range.find()) {
            boolean kA = !range.group(2).isEmpty();
            boolean kB = !range.group(4).isEmpty();
            long rawA = Long.parseLong(range.group(1));
            long rawB = Long.parseLong(range.group(3));
            boolean priceLike = kA || kB || (rawA >= 1000 && rawB >= 1000);
            if (priceLike) {
                int a = toVnd(range.group(1), kA);
                int b = toVnd(range.group(3), kB);
                return new PriceFilter(Math.min(a, b), Math.max(a, b));
            }
        }

        // 2) Max only.
        //    - "<=" / "<" + số (k tuỳ chọn) — comparator rõ ràng, luôn coi là giá.
        //    - Từ Việt ("dưới", "không quá", "tối đa", "nhỏ hơn") + số — yêu cầu có "k"
        //      HOẶC số ≥ 1000 để tránh nhầm "dưới 5 phút".
        java.util.regex.Matcher mMaxOp = java.util.regex.Pattern
                .compile("(?:<=|<)\\s*(\\d+)\\s*([kK]?)").matcher(msg);
        if (mMaxOp.find()) {
            boolean k = !mMaxOp.group(2).isEmpty();
            return new PriceFilter(null, toVnd(mMaxOp.group(1), k));
        }
        java.util.regex.Matcher mMaxWord = java.util.regex.Pattern
                .compile("(?:dưới|duoi|không\\s*quá|khong\\s*qua|tối\\s*đa|toi\\s*da|nhỏ\\s*hơn|nho\\s*hon)\\s*(\\d+)\\s*([kK]?)")
                .matcher(msg);
        if (mMaxWord.find()) {
            boolean k = !mMaxWord.group(2).isEmpty();
            long raw = Long.parseLong(mMaxWord.group(1));
            if (k || raw >= 1000) {
                return new PriceFilter(null, toVnd(mMaxWord.group(1), k));
            }
        }

        // 3) Min only — comparator + từ Việt, áp dụng quy tắc tương tự max.
        java.util.regex.Matcher mMinOp = java.util.regex.Pattern
                .compile("(?:>=|>)\\s*(\\d+)\\s*([kK]?)").matcher(msg);
        if (mMinOp.find()) {
            boolean k = !mMinOp.group(2).isEmpty();
            return new PriceFilter(toVnd(mMinOp.group(1), k), null);
        }
        java.util.regex.Matcher mMinWord = java.util.regex.Pattern
                .compile("(?:trên|tren|hơn|hon|lớn\\s*hơn|lon\\s*hon|tối\\s*thiểu|toi\\s*thieu|từ\\s+ít\\s*nhất)\\s*(\\d+)\\s*([kK]?)")
                .matcher(msg);
        if (mMinWord.find()) {
            boolean k = !mMinWord.group(2).isEmpty();
            long raw = Long.parseLong(mMinWord.group(1));
            if (k || raw >= 1000) {
                return new PriceFilter(toVnd(mMinWord.group(1), k), null);
            }
        }
        java.util.regex.Matcher mUp = java.util.regex.Pattern
                .compile("(\\d+)\\s*([kK]?)\\s*(?:trở\\s*lên|tro\\s*len)")
                .matcher(msg);
        if (mUp.find()) {
            boolean k = !mUp.group(2).isEmpty();
            long raw = Long.parseLong(mUp.group(1));
            if (k || raw >= 1000) {
                return new PriceFilter(toVnd(mUp.group(1), k), null);
            }
        }

        // 4) "Xk" trần trụi kèm từ khoá tài chính → coi là max.
        java.util.regex.Matcher mBareK = java.util.regex.Pattern
                .compile("(?<![0-9])(\\d{1,3})\\s*[kK]\\b").matcher(msg);
        if (mBareK.find() && (msg.contains("lọc") || msg.contains("loc")
                || msg.contains("ngân sách") || msg.contains("ngan sach")
                || msg.contains("túi tiền") || msg.contains("tui tien")
                || msg.contains("budget"))) {
            return new PriceFilter(null, Integer.parseInt(mBareK.group(1)) * 1000);
        }

        return PriceFilter.NONE;
    }

    /** Quy đổi chuỗi số sang VND. Có "k" hoặc giá trị nhỏ (&lt;1000) → ×1000. */
    private static int toVnd(String numStr, boolean kSuffix) {
        long n = Long.parseLong(numStr);
        if (kSuffix || n < 1000) {
            n *= 1000;
        }
        if (n > Integer.MAX_VALUE) {
            n = Integer.MAX_VALUE;
        }
        return (int) n;
    }

    /** Nhận diện cụm "N người" (1..20). */
    public static boolean mentionsNumberOfPeople(String msg) {
        return N_PEOPLE.matcher(msg).matches();
    }

    /**
     * Khách muốn xem dạng LIỆT KÊ nhiều món (vd. "sushi có những món gì",
     * "liệt kê món hải sản") — tăng giới hạn trả về của handler tương ứng.
     */
    public static boolean isMenuListingFollowup(String msgRaw) {
        if (msgRaw == null) {
            return false;
        }
        String msg = msgRaw.toLowerCase(Locale.ROOT);
        return msg.contains("có gì") || msg.contains("có những") || msg.contains("những món")
                || msg.contains("món gì") || msg.contains("mon gi")
                || msg.contains("gồm những") || msg.contains("gồm món") || msg.contains("bao gồm")
                || msg.contains("liệt kê") || msg.contains("liet ke") || msg.contains("danh sách")
                || msg.contains("đang có") || msg.contains("dang co")
                || (msg.contains("món nào") && !msg.contains("ngon"));
    }
}

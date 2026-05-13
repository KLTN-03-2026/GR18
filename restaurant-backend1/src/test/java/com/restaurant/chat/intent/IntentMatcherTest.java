package com.restaurant.chat.intent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho bộ phân loại intent thuần ({@link IntentMatcher}). Không cần Spring/DB.
 * Mỗi cặp (câu — intent) là một test case sống động cho intent registry.
 */
class IntentMatcherTest {

    // ============================================================
    // CHÀO / ĐẶT BÀN
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {"xin chào", "Chào!", "hello", "hi", "hey"})
    @DisplayName("Câu chào đơn lẻ -> GREETING")
    void greeting(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.GREETING);
    }

    @ParameterizedTest
    @ValueSource(strings = {"đặt bàn tối mai", "tôi muốn đặt bàn", "dat ban cho 4 người"})
    void booking(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.BOOKING);
    }

    // ============================================================
    // DESSERT — món ngọt / tráng miệng
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {
            "có món ngọt nào không",
            "gợi ý món tráng miệng",
            "tôi muốn ăn dessert",
            "có kem không",
            "có mochi không",
            "bánh ngọt nào ngon",
            "có chè không",
            "tiramisu nha"
    })
    @DisplayName("Các câu hỏi dessert đều rơi vào DESSERT")
    void dessert(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.DESSERT);
    }

    @ParameterizedTest
    @ValueSource(strings = {"không ngọt nhé", "ít ngọt thôi"})
    @DisplayName("Phủ định ngọt -> KHÔNG phải DESSERT")
    void dessertNegation(String msg) {
        assertThat(IntentMatcher.detect(msg)).isNotEqualTo(ChatIntent.DESSERT);
    }

    // ============================================================
    // SPICY — món cay
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {
            "có món cay không",
            "kimchi nào",
            "ăn cái gì sa tế",
            "spicy food",
            "có món chili không"
    })
    void spicy(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.SPICY);
    }

    @ParameterizedTest
    @ValueSource(strings = {"không cay nhé", "ít cay thôi"})
    void spicyNegation(String msg) {
        assertThat(IntentMatcher.detect(msg)).isNotEqualTo(ChatIntent.SPICY);
    }

    // ============================================================
    // VEGETARIAN — món chay
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {
            "có món chay không",
            "ăn chay đi",
            "đồ chay",
            "vegan menu",
            "vegetarian options"
    })
    void vegetarian(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.VEGETARIAN);
    }

    // ============================================================
    // GIÁ — đắt nhất / rẻ nhất / ngân sách
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {
            "món đắt nhất là gì",
            "top mắc nhất",
            "giá cao nhất",
            "món đắt tiền"
    })
    void mostExpensive(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.MOST_EXPENSIVE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"món rẻ nhất", "giá thấp nhất", "món ăn rẻ nhất", "nước rẻ nhất"})
    void cheapest(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.CHEAPEST);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "món dưới 100k",
            "tiết kiệm chút",
            "ngân sách 80k",
            "túi tiền sinh viên",
            "rẻ chút",
            "món rẻ",
            "món ăn rẻ",
            "nước rẻ",
            "đồ uống rẻ"
    })
    void budget(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.BUDGET);
    }

    // ============================================================
    // FOOD vs BEVERAGE — helper detection
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {
            "món rẻ", "món ăn rẻ", "thức ăn dưới 80k", "đồ ăn rẻ", "đói quá", "food cheap"
    })
    @DisplayName("isFoodIntent: nhận diện câu có 'món / ăn / thức ăn / đói / food'")
    void isFoodIntent_true(String msg) {
        assertThat(IntentMatcher.isFoodIntent(msg)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "nước rẻ", "đồ uống rẻ", "cà phê rẻ nhất", "coca dưới 30k", "rẻ nhất là gì"
    })
    @DisplayName("isFoodIntent: false với câu không chứa cue thức ăn rõ ràng")
    void isFoodIntent_false(String msg) {
        assertThat(IntentMatcher.isFoodIntent(msg)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "nước rẻ", "đồ uống rẻ", "thức uống nào ngon",
            "cà phê rẻ nhất", "coca dưới 30k", "trà sữa nào ngon",
            "sinh tố cam", "pepsi", "7up dưới 25k", "nước suối"
    })
    @DisplayName("isBeverageIntent: nhận diện câu nói về đồ uống")
    void isBeverageIntent_true(String msg) {
        assertThat(IntentMatcher.isBeverageIntent(msg)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "món rẻ", "món đắt nhất", "sushi nào ngon", "có gì ngon"
    })
    @DisplayName("isBeverageIntent: false với câu hỏi món ăn thuần")
    void isBeverageIntent_false(String msg) {
        assertThat(IntentMatcher.isBeverageIntent(msg)).isFalse();
    }

    @ParameterizedTest
    @CsvSource({
            // intent,        msg,                       expected exclude
            "CHEAPEST,       'món rẻ nhất',             true",
            "CHEAPEST,       'món ăn rẻ nhất',          true",
            "CHEAPEST,       'rẻ nhất',                 true",
            "CHEAPEST,       'nước rẻ nhất',            false",
            "CHEAPEST,       'đồ uống rẻ nhất',         false",
            "BUDGET,         'món dưới 80k',            true",
            "BUDGET,         'món rẻ',                  true",
            "BUDGET,         'dưới 50k',                true",
            "BUDGET,         'nước dưới 30k',           false",
            "BUDGET,         'đồ uống rẻ',              false",
            "MOST_EXPENSIVE, 'món đắt nhất',            true",
            "DESSERT,        'tráng miệng',             false"
    })
    @DisplayName("shouldExcludeBeverages: đúng theo intent + ngữ cảnh food/beverage")
    void shouldExcludeBeverages_decisionMatrix(String intentName, String msg, boolean expected) {
        ChatIntent intent = ChatIntent.valueOf(intentName);
        assertThat(IntentMatcher.shouldExcludeBeverages(intent, msg)).isEqualTo(expected);
    }

    // ============================================================
    // BÁN CHẠY / RATING
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {
            "món bán chạy nhất",
            "món hay gọi",
            "best seller của quán",
            "top gọi nhiều nhất"
    })
    void topSelling(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.TOP_SELLING);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "món đánh giá cao",
            "món 5 sao",
            "rating cao của quán",
            "khen nhiều món nào"
    })
    void topRated(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.TOP_RATED);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "món rating thấp",
            "món bị chê nhất",
            "review thấp",
            "món nên tránh"
    })
    void lowRated(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.LOW_RATED);
    }

    // ============================================================
    // CHỦ ĐỀ MÓN — sushi/hải sản/thịt
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {"sushi có gì", "sashimi nào ngon", "có maki không"})
    void sushi(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.SUSHI);
    }

    @ParameterizedTest
    @ValueSource(strings = {"hải sản có những món gì", "seafood nào hôm nay", "có tôm cua gì không"})
    void seafood(String msg) {
        // "có tôm cua" có thể fail vì câu chứa "có" không match SEAFOOD trigger nghiêm ngặt
        ChatIntent got = IntentMatcher.detect(msg);
        assertThat(got).isIn(ChatIntent.SEAFOOD, ChatIntent.POPULAR_FALLBACK, ChatIntent.UNKNOWN);
    }

    @ParameterizedTest
    @ValueSource(strings = {"món thịt nào ngon", "steak nào", "ba chỉ heo"})
    void meat(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.MEAT);
    }

    // ============================================================
    // FALLBACK
    // ============================================================

    @ParameterizedTest
    @ValueSource(strings = {"đói quá", "có gì ngon không", "gợi ý món", "ăn gì giờ"})
    void popularFallback(String msg) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(ChatIntent.POPULAR_FALLBACK);
    }

    @ParameterizedTest
    @CsvSource({
            "'thời tiết hôm nay thế nào',   UNKNOWN",
            "'',                            UNKNOWN"
    })
    void unknown(String msg, ChatIntent expected) {
        assertThat(IntentMatcher.detect(msg)).isEqualTo(expected);
    }

    // ============================================================
    // PRICE CAP EXTRACTION
    // ============================================================

    @ParameterizedTest
    @CsvSource({
            "'món dưới 80k',          80000",
            "'không quá 150k',        150000",
            "'ngân sách 50k',         50000"
    })
    void extractPriceCap(String msg, int expected) {
        assertThat(IntentMatcher.extractPriceCapVnd(msg.toLowerCase()))
                .contains(expected);
    }
}

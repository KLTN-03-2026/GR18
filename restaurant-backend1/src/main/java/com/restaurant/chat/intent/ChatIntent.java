package com.restaurant.chat.intent;

/**
 * Tập hợp ý định (intent) chatbot hỗ trợ. Mỗi intent có một nhánh logic riêng,
 * tránh dùng chung pool gây kết quả trùng nhau.
 *
 * <p>Thứ tự enum mang ý nghĩa "ưu tiên" khi nhiều intent cùng match — intent ở trên
 * cùng được kiểm tra trước (xem {@link IntentMatcher}).
 */
public enum ChatIntent {

    GREETING,
    BOOKING,

    DESSERT,            // món ngọt / tráng miệng
    SPICY,              // món cay
    VEGETARIAN,         // món chay

    MOST_EXPENSIVE,     // món đắt nhất (sort price DESC)
    CHEAPEST,           // món rẻ nhất (sort price ASC)
    BUDGET,             // dưới X tiền / túi tiền sinh viên

    TOP_SELLING,        // bán chạy
    TOP_RATED,          // đánh giá cao
    LOW_RATED,          // đánh giá thấp

    SEAFOOD,
    MEAT,
    SUSHI,
    HEALTHY,

    BY_CATEGORY,        // khớp tên danh mục cụ thể
    MENU_OVERVIEW,      // hỏi chung "menu có gì"
    SIGNATURE,          // signature / đặc trưng / nổi bật

    POPULAR_FALLBACK,   // "đói", "ăn gì", "ngon", "gợi ý" — gọi top + Gemini
    UNKNOWN
}

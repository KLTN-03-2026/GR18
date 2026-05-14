package com.restaurant.chat.intent;

/**
 * Khoảng giá người dùng yêu cầu được rút ra từ câu chat.
 *
 * <p>Mỗi giá trị là VND tuyệt đối (đã quy đổi từ "k" sang đơn vị đồng).
 * Giá trị {@code null} đồng nghĩa "không giới hạn" ở chiều đó:
 * <ul>
 *   <li>{@code minVnd=null, maxVnd=100_000} → "dưới 100k"</li>
 *   <li>{@code minVnd=100_000, maxVnd=null} → "trên 100k"</li>
 *   <li>{@code minVnd=50_000, maxVnd=100_000} → "từ 50k đến 100k"</li>
 *   <li>{@link #isEmpty()} → khách không nói khoảng giá nào</li>
 * </ul>
 */
public record PriceFilter(Integer minVnd, Integer maxVnd) {

    public static final PriceFilter NONE = new PriceFilter(null, null);

    public boolean isEmpty() {
        return minVnd == null && maxVnd == null;
    }

    public boolean hasMin() {
        return minVnd != null;
    }

    public boolean hasMax() {
        return maxVnd != null;
    }

    public boolean isRange() {
        return minVnd != null && maxVnd != null;
    }
}

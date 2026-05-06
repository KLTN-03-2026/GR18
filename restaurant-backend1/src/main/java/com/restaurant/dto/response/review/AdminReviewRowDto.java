package com.restaurant.dto.response.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Một dòng đánh giá cho trang quản trị — chỉ field cần hiển thị, tránh JSON quá lớn / lỗi parse.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminReviewRowDto {

    private Long id;
    private String guestName;
    private Integer rating;
    private String comment;
    private Boolean isVisible;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private UserBrief user;
    private MenuItemBrief menuItem;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserBrief {
        private Long id;
        private String fullName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MenuItemBrief {
        private Long id;
        private String name;
    }
}

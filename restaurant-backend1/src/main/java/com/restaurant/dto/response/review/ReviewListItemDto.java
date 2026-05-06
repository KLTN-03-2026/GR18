package com.restaurant.dto.response.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Đánh giá dạng rút gọn cho API công khai / khách — tránh lazy proxy khi serialize JSON. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewListItemDto {

    private Long id;
    private String guestName;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;
    private UserBrief user;
    private MenuItemBrief menuItem;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserBrief {
        private Long id;
        private String fullName;
        private String avatarUrl;
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

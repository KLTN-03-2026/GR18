package com.restaurant.dto.response.menu_items;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AdminMenuItemResponse {

    Long id;

    String name;

    String description;

    BigDecimal price;

    String imageUrl;

    Boolean isAvailable;

    Boolean isActive;

    String categoryName;

    /** Để form sửa chọn đúng danh mục */
    Long categoryId;

    Integer totalSold;

    Double avgRating;
}

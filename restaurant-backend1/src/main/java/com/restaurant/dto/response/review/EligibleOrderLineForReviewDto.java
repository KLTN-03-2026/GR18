package com.restaurant.dto.response.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EligibleOrderLineForReviewDto {
    private Long menuItemId;
    private String menuItemName;
    private String imageUrl;
    private int quantity;
}

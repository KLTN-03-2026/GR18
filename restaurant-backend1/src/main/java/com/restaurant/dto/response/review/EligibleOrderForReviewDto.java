package com.restaurant.dto.response.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EligibleOrderForReviewDto {
    private Long orderId;
    private LocalDateTime paidAt;
    private String tableInfo;
    private List<EligibleOrderLineForReviewDto> lines;
}

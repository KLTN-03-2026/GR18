package com.restaurant.dto.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAdminStatsResponse {
    private long totalSuggestions;
    private long totalAccepted;
    /** Tỷ lệ 0..1 khách chọn món từ danh sách gợi ý (theo sự kiện ghi nhận). */
    private double acceptanceRate;
    private Map<String, Long> suggestionsBySource;
}

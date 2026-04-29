package com.restaurant.dto.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAdminConfigResponse {
    private Boolean aiEnabled;
    private Boolean geminiEnabled;
    private String pinnedMenuItemIdsJson;
    private String restrictCategoryIdsJson;
    private Integer historyLookbackDays;
    private Double ratingWeight;
    private Double salesWeight;
    private Integer geminiTimeoutMs;
    private Boolean anonymizeAnalytics;
    private Boolean geminiKeyConfigured;
    private Instant updatedAt;
}

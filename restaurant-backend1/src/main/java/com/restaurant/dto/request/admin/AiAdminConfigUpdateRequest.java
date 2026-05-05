package com.restaurant.dto.request.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class AiAdminConfigUpdateRequest {
    private Boolean aiEnabled;
    private Boolean geminiEnabled;
    private String pinnedMenuItemIdsJson;
    private String restrictCategoryIdsJson;

    @Min(7)
    @Max(730)
    private Integer historyLookbackDays;

    @Min(0)
    @Max(1)
    private Double ratingWeight;

    @Min(0)
    @Max(1)
    private Double salesWeight;

    @Min(800)
    @Max(10000)
    private Integer geminiTimeoutMs;

    private Boolean anonymizeAnalytics;
}

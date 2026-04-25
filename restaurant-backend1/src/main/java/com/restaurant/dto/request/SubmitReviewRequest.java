package com.restaurant.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class SubmitReviewRequest {

    @NotNull
    private Long menuItemId;

    @NotNull
    private Long orderId;

    @NotNull
    @Min(1)
    @Max(5)
    private Integer rating;

    @Size(max = 1000)
    private String comment;
}

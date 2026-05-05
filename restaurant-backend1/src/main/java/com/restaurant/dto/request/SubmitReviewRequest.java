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

    @NotBlank(message = "Nội dung đánh giá không được để trống")
    @Size(max = 2000, message = "Nội dung tối đa 2000 ký tự")
    private String comment;
}

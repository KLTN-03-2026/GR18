package com.restaurant.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class GuestSubmitReviewRequest {

    @NotNull
    private Long orderId;

    @NotNull
    private Long menuItemId;

    @NotNull
    @Min(1)
    @Max(5)
    private Integer rating;

    @NotBlank(message = "Nội dung đánh giá không được để trống")
    @Size(max = 2000)
    private String comment;

    /** Mã QR bàn — xác minh đơn thuộc bàn khách đang dùng. */
    @NotBlank
    @Size(max = 200)
    private String qrCodeToken;
}

package com.restaurant.dto.request;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import lombok.Data;

@Data
public class CreateReservationRequest {
    @NotNull
    @Future(message = "Thời gian đặt bàn phải là mốc trong tương lai (không được chọn ngày giờ đã qua).")
    private LocalDateTime reservationTime;

    @NotNull
    @Min(1)
    private Integer numberOfGuests;

    @NotBlank
    private String customerName;

    @NotBlank
    private String customerPhone;

    private Long tableId;

    private String note;

    /** Email nhận thông báo xác nhận; nếu trống dùng email tài khoản. */
    @jakarta.validation.constraints.Email(message = "Email không hợp lệ")
    @jakarta.validation.constraints.Size(max = 150)
    private String customerEmail;
}


package com.restaurant.dto.request;

import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class ReservationRequest {

    @NotNull(message = "Thời gian đặt bàn không được để trống")
    @Future(message = "Thời gian đặt phải là tương lai")
    private LocalDateTime reservationTime;

    @NotNull(message = "Số lượng khách không được để trống")
    @Min(value = 1, message = "Số lượng khách tối thiểu là 1")
    @Max(value = 50, message = "Số lượng khách tối đa là 50")
    private Integer numberOfGuests;

    @NotBlank(message = "Tên khách hàng không được để trống")
    private String customerName;

    @NotBlank(message = "Số điện thoại không được để trống")
    private String customerPhone;

    private Long tableId;   // null = để hệ thống tự chọn

    private String note;
}

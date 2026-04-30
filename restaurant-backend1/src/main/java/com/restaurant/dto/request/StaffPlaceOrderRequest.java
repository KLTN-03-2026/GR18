package com.restaurant.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Nhân viên tạo đơn và gắn trực tiếp theo {@code tableId} (không quét QR).
 */
@Data
public class StaffPlaceOrderRequest {

    @NotNull(message = "Chưa chọn bàn")
    private Long tableId;

    @NotBlank(message = "Tên khách không được để trống")
    private String guestName;

    private String note;

    @NotNull(message = "Chưa có món trong đơn")
    @NotEmpty(message = "Đơn cần ít nhất một món")
    @Valid
    private List<OrderRequest.OrderItemRequest> items;
}

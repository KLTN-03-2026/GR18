package com.restaurant.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

@Data
public class OrderRequest {
    // null = khách vãng lai
    private Long userId;

    @NotBlank(message = "Tên khách không được để trống")
    private String guestName;

    @NotNull(message = "Mã bàn không được để trống")
    private String qrToken;     // Token từ mã QR

    private String note;

    @NotNull
    private List<OrderItemRequest> items;

    @Data
    public static class OrderItemRequest {
        @NotNull
        private Long menuItemId;

        @NotNull
        @Positive
        private Integer quantity;

        private String note;    // ít cay, không hành...
    }
}

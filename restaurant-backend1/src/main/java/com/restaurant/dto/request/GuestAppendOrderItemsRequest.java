package com.restaurant.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class GuestAppendOrderItemsRequest {

    @NotBlank(message = "Mã bàn không được để trống")
    private String qrToken;

    @NotNull
    private List<OrderRequest.OrderItemRequest> items;
}

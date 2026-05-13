package com.restaurant.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class StaffAppendOrderItemsRequest {

    @NotEmpty(message = "Phải có ít nhất một món để thêm")
    @Valid
    private List<OrderRequest.OrderItemRequest> items;
}

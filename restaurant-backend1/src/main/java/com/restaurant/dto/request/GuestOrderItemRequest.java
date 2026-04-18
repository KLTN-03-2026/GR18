package com.restaurant.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GuestOrderItemRequest {
    @NotNull
    private Long menuItemId;

    @NotNull
    @Min(1)
    private Integer quantity;

    private String note;
}


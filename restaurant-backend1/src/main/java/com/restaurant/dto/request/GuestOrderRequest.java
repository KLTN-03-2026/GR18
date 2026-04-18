package com.restaurant.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Data;

@Data
public class GuestOrderRequest {
    @NotBlank
    private String guestName;

    @NotBlank
    private String qrToken;

    private String note;

    @Valid
    @NotEmpty
    private List<GuestOrderItemRequest> items;
}


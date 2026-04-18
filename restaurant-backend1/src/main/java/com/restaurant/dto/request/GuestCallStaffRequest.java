package com.restaurant.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GuestCallStaffRequest {
    @NotBlank
    private String qrToken;

    private String note;
}


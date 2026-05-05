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
    @Future
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
}


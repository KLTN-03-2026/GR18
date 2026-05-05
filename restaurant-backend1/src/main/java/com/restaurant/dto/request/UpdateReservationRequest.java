package com.restaurant.dto.request;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class UpdateReservationRequest {
    private Long tableId;
    private LocalDateTime reservationTime;
    private Integer numberOfGuests;
    private String customerName;
    private String customerPhone;
    private String note;
    private String status;
}


package com.restaurant.dto.response;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationHistoryItemResponse {
    private Long id;
    private LocalDateTime reservationTime;
    private Integer numberOfGuests;
    private String customerName;
    private String customerPhone;
    private String status;
    private String tableNumber;
    private String note;
}


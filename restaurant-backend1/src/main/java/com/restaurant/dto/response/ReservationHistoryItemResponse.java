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
    /** FK `restaurant_tables.id`; null nếu chưa gắn bàn cụ thể */
    private Long tableId;
    private LocalDateTime reservationTime;
    private Integer numberOfGuests;
    private String customerName;
    private String customerPhone;
    private String status;
    private String tableNumber;
    /** Vị trí bàn đã gán (JOIN restaurant_tables.location) */
    private String tableLocation;
    private String note;
}


package com.restaurant.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.restaurant.entity.enums.ReservationStatus;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReservationResponse {
    private Long id;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime reservationTime;
    private Integer numberOfGuests;
    private String customerName;
    private String customerPhone;
    private String note;
    private ReservationStatus status;

    // Chỉ trả về thông tin cần thiết của Bàn
    private Long tableId;
    private String tableNumber;

    // Thông tin audit
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}

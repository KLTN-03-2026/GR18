package com.restaurant.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuestOrderStatusResponse {
    private Long id;
    private String status;
    private BigDecimal totalAmount;
    private String paymentStatus;
    private LocalDateTime createdAt;
}


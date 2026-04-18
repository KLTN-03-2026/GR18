package com.restaurant.dto.response.order;

import com.restaurant.entity.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffOrderResponse {
    private Long id;
    private Long tableId;
    private String tableNumber;
    private String guestName;
    private BigDecimal totalAmount;
    private OrderStatus status;
    private LocalDateTime createdAt;
    private String note;
    private String mainItem;
    private int itemCount;
}

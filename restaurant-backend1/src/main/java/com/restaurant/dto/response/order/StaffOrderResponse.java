package com.restaurant.dto.response.order;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.entity.enums.PaymentMethod;
import com.restaurant.entity.enums.PaymentStatus;
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
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime paidAt;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    private String note;
    private String mainItem;
    private int itemCount;
}

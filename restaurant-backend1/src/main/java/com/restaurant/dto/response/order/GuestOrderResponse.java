package com.restaurant.dto.response.order;

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
public class GuestOrderResponse {
    private Long id;
    private Long tableId;
    private String tableNumber;
    private String guestName;
    private OrderStatus status;
    /** Thanh toán — hữu ích cho khách đã đăng nhập xem /orders/me; có thể null với một số bản serial cũ. */
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private LocalDateTime paidAt;

    private BigDecimal totalAmount;
    private String note;
    private LocalDateTime createdAt;
}

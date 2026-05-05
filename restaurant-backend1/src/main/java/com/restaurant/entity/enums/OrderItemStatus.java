package com.restaurant.entity.enums;

public enum OrderItemStatus {
    PENDING,        // Chờ bếp
    PREPARING,      // Đang chế biến
    READY,          // Đã xong, chờ phục vụ
    SERVED,         // Đã phục vụ
    CANCELLED       // Đã hủy
}

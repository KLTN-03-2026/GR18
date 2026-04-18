package com.restaurant.entity.enums;

public enum OrderStatus {
    PENDING,        // Chờ xử lý
    PREPARING,      // Đang chuẩn bị / bếp đang chế biến
    SERVING,        // Đang phục vụ
    COMPLETED,      // Hoàn thành
    CANCELLED       // Đã hủy
}

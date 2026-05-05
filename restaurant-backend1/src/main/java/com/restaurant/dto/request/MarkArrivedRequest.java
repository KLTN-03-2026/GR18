package com.restaurant.dto.request;

import lombok.Data;

@Data
public class MarkArrivedRequest {

    /** Bàn cụ thể khách nhận (phải trùng bàn quét QR khi đặt món). Tuỳ chọn nếu đã có table_id khi đặt bàn. */
    private Long tableId;
}

package com.restaurant.chat;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingContext {
    private String date;     // yyyy-MM-dd
    private String time;     // HH:mm
    private Integer guests;
    private boolean confirmed;

    public boolean isComplete() {
        return date != null && time != null && guests != null;
    }
}
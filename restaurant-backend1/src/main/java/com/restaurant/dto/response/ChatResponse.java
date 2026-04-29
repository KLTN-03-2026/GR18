package com.restaurant.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChatResponse {
     String reply;
     String status;
    Object data;
     /** Id log gợi ý (để khách bấm món báo tiếp nhận gợi ý). */
     Long suggestionLogId;
}
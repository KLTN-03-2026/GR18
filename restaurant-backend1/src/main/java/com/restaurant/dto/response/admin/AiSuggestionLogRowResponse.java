package com.restaurant.dto.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSuggestionLogRowResponse {
    private Long id;
    private Instant createdAt;
    private String source;
    private int suggestedCount;
    private Long acceptedMenuItemId;
    private Instant acceptedAt;
    private String replyPreview;
}

package com.restaurant.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChatSuggestionFeedbackRequest {
    @NotNull
    private Long suggestionLogId;
    @NotNull
    private Long menuItemId;
}

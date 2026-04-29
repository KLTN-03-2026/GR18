package com.restaurant.controller;

import com.restaurant.dto.request.ChatRequest;
import com.restaurant.dto.request.ChatSuggestionFeedbackRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.ChatResponse;
import com.restaurant.entity.User;
import com.restaurant.service.AiSuggestionLogService;
import com.restaurant.service.ChatService;
import com.restaurant.service.UserManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/chat", "/chatbot"})
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ChatController {

    private final ChatService chatService;
    private final UserManagementService userManagementService;
    private final AiSuggestionLogService aiSuggestionLogService;

    @PostMapping
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            Authentication authentication) {

        User currentUser = null;

        if (authentication != null) {
            currentUser = userManagementService.getCurrentUser(authentication);
        }

        ChatResponse response = chatService.handleMessage(
                request.getMessage(),
                request.getSessionId(),
                currentUser
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping("/suggestion-feedback")
    public ResponseEntity<ApiResponse<Void>> suggestionFeedback(
            @Valid @RequestBody ChatSuggestionFeedbackRequest request) {
        aiSuggestionLogService.markAccepted(request.getSuggestionLogId(), request.getMenuItemId());
        return ResponseEntity.ok(ApiResponse.success(null, "Đã ghi nhận lượt chọn món từ gợi ý"));
    }
}

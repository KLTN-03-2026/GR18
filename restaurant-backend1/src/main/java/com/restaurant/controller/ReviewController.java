package com.restaurant.controller;

import com.restaurant.dto.request.SubmitReviewRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.entity.Review;
import com.restaurant.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Review", description = "Đánh giá món ăn")
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping("/menu/{menuItemId}/reviews")
    @Operation(summary = "Xem đánh giá của một món ăn (Public)")
    public ResponseEntity<ApiResponse<List<Review>>> getReviews(
            @PathVariable Long menuItemId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reviewService.listVisibleByMenuItem(menuItemId, page, size)));
    }

    @PostMapping("/reviews")
    @Operation(summary = "Gửi đánh giá món ăn (US09)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Review>> submitReview(
            Authentication authentication,
            @Valid @RequestBody SubmitReviewRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        Review saved = reviewService.submitReview(userId, request);
        return ResponseEntity.ok(ApiResponse.success(saved, "Cảm ơn bạn đã đánh giá!"));
    }
}

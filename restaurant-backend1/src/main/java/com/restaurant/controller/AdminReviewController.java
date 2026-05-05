package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.entity.Review;
import com.restaurant.service.AdminReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@Validated
@Tag(name = "Admin - Review", description = "Quản trị đánh giá món ăn (US26)")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminReviewController {

    private final AdminReviewService adminReviewService;

    @GetMapping("/admin/reviews")
    @Operation(summary = "Admin: Xem tất cả đánh giá")
    public ResponseEntity<ApiResponse<Page<Review>>> getAllReviews(
            @RequestParam(required = false) Long menuItemId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) @Min(1) @Max(5) Integer minRating,
            @RequestParam(required = false) @Min(1) @Max(5) Integer maxRating,
            @RequestParam(required = false) Boolean isVisible,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Review> reviews = adminReviewService.findReviewsForAdmin(
                menuItemId, userId, minRating, maxRating, isVisible, pageable);
        return ResponseEntity.ok(ApiResponse.success(reviews));
    }

    @GetMapping("/admin/reviews/{id}")
    @Operation(summary = "Admin: Xem chi tiết đánh giá")
    public ResponseEntity<ApiResponse<Review>> getReview(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(adminReviewService.getByIdOrThrow(id)));
    }

    @PatchMapping("/admin/reviews/{id}/visibility")
    @Operation(summary = "Admin: Ẩn / Hiện đánh giá (US26)")
    public ResponseEntity<ApiResponse<Review>> toggleVisibility(
            @PathVariable Long id,
            @RequestParam boolean isVisible) {
        Review saved = adminReviewService.setVisibility(id, isVisible);
        String msg = isVisible ? "Đã hiện đánh giá" : "Đã ẩn đánh giá";
        return ResponseEntity.ok(ApiResponse.success(saved, msg));
    }

    @DeleteMapping("/admin/reviews/{id}")
    @Operation(summary = "Admin: Xóa đánh giá vi phạm (US26)")
    public ResponseEntity<ApiResponse<Void>> deleteReview(@PathVariable Long id) {
        adminReviewService.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa đánh giá vi phạm"));
    }
}

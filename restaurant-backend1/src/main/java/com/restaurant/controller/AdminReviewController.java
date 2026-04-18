package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.entity.Review;
import com.restaurant.repository.ReviewRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Admin Review Management Controller (US26)
 * Quản lý đánh giá: ẩn/hiện, xóa vi phạm
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Admin - Review", description = "Quản trị đánh giá món ăn (US26)")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminReviewController {

    private final ReviewRepository reviewRepository;

    /**
     * US26: Xem tất cả reviews — filter theo menuItemId, minRating, maxRating, isVisible
     */
    @GetMapping("/admin/reviews")
    @Operation(summary = "Admin: Xem tất cả đánh giá")
    public ResponseEntity<ApiResponse<Page<Review>>> getAllReviews(
            @RequestParam(required = false) Long menuItemId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Integer minRating,
            @RequestParam(required = false) Integer maxRating,
            @RequestParam(required = false) Boolean isVisible,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        // Filter bằng Specification-style inline
        Page<Review> reviews;
        if (menuItemId != null) {
            reviews = reviewRepository.findByMenuItemIdAndIsVisibleTrue(menuItemId, pageable);
        } else {
            reviews = reviewRepository.findAll(pageable);
        }

        // Post-filter phía Java (đơn giản hóa — có thể nâng cấp bằng Specification sau)
        if (minRating != null || maxRating != null || isVisible != null || userId != null) {
            final int min = (minRating != null) ? minRating : 1;
            final int max = (maxRating != null) ? maxRating : 5;
            final Boolean vis = isVisible;
            final Long uid = userId;

            reviews = reviews.map(r -> r) // map = identity, just to trigger filter below
                    .map(r -> r);

            // Re-query với findAll và filter — đơn giản nhất không cần Specification
            Page<Review> all = reviewRepository.findAll(pageable);
            reviews = new org.springframework.data.domain.PageImpl<>(
                    all.stream()
                            .filter(r -> r.getRating() >= min && r.getRating() <= max)
                            .filter(r -> vis == null || r.getIsVisible().equals(vis))
                            .filter(r -> uid == null || r.getUser().getId().equals(uid))
                            .filter(r -> menuItemId == null || r.getMenuItem().getId().equals(menuItemId))
                            .toList(),
                    pageable,
                    all.getTotalElements()
            );
        }

        return ResponseEntity.ok(ApiResponse.success(reviews));
    }

    /**
     * US26: Lấy chi tiết một review
     */
    @GetMapping("/admin/reviews/{id}")
    @Operation(summary = "Admin: Xem chi tiết đánh giá")
    public ResponseEntity<ApiResponse<Review>> getReview(@PathVariable Long id) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Đánh giá không tồn tại"));
        return ResponseEntity.ok(ApiResponse.success(review));
    }

    /**
     * US26: Ẩn / Hiện review (toggle visibility)
     */
    @PatchMapping("/admin/reviews/{id}/visibility")
    @Operation(summary = "Admin: Ẩn / Hiện đánh giá (US26)")
    public ResponseEntity<ApiResponse<Review>> toggleVisibility(
            @PathVariable Long id,
            @RequestParam boolean isVisible) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Đánh giá không tồn tại"));
        review.setIsVisible(isVisible);
        Review saved = reviewRepository.save(review);
        String msg = isVisible ? "Đã hiện đánh giá" : "Đã ẩn đánh giá";
        return ResponseEntity.ok(ApiResponse.success(saved, msg));
    }

    /**
     * US26: Xóa review vi phạm (xóa vĩnh viễn)
     */
    @DeleteMapping("/admin/reviews/{id}")
    @Operation(summary = "Admin: Xóa đánh giá vi phạm (US26)")
    public ResponseEntity<ApiResponse<Void>> deleteReview(@PathVariable Long id) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Đánh giá không tồn tại"));
        reviewRepository.delete(review);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa đánh giá vi phạm"));
    }
}

package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.entity.MenuItem;
import com.restaurant.entity.Order;
import com.restaurant.entity.Review;
import com.restaurant.entity.User;
import com.restaurant.repository.MenuItemRepository;
import com.restaurant.repository.OrderRepository;
import com.restaurant.repository.ReviewRepository;
import com.restaurant.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import java.math.BigDecimal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Review", description = "Đánh giá món ăn")
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    @GetMapping("/menu/{menuItemId}/reviews")
    @Operation(summary = "Xem đánh giá của một món ăn (Public)")
    public ResponseEntity<ApiResponse<List<Review>>> getReviews(
            @PathVariable Long menuItemId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reviewRepository.findByMenuItemIdAndIsVisibleTrue(
                        menuItemId, PageRequest.of(page, size)).getContent()));
    }

    /**
     * US09: Gửi đánh giá món ăn
     * Điều kiện: đã đăng nhập, đơn hàng phải COMPLETED và thuộc về user
     */
    @PostMapping("/reviews")
    @Operation(summary = "Gửi đánh giá món ăn (US09)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Review>> submitReview(
            Authentication authentication,
            @Valid @RequestBody ReviewRequest request) {
        Long userId = Long.parseLong(authentication.getName());

        // Kiểm tra đơn hàng tồn tại và thuộc user
        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Bạn không có quyền đánh giá đơn hàng này");
        }
        if (order.getStatus() != com.restaurant.entity.enums.OrderStatus.COMPLETED) {
            throw new IllegalStateException("Chỉ có thể đánh giá sau khi đơn hàng hoàn thành");
        }

        // Kiểm tra xem đã đánh giá chưa (1 đơn = 1 lần review)
        if (reviewRepository.findByUserIdAndOrderId(userId, request.getOrderId()).isPresent()) {
            throw new IllegalStateException("Đơn hàng này đã được đánh giá rồi");
        }

        MenuItem menuItem = menuItemRepository.findById(request.getMenuItemId())
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại"));

        Review review = Review.builder()
                .user(user)
                .menuItem(menuItem)
                .order(order)
                .rating(request.getRating())
                .comment(request.getComment())
                .isVisible(true)
                .build();
        Review saved = reviewRepository.save(review);

        // Cập nhật avgRating của món ăn
        Double avg = reviewRepository.calculateAvgRatingByMenuItem(menuItem.getId());
        menuItem.setAvgRating(avg != null ? BigDecimal.valueOf(avg) : BigDecimal.ZERO);
        menuItemRepository.save(menuItem);

        return ResponseEntity.ok(ApiResponse.success(saved, "Cảm ơn bạn đã đánh giá!"));
    }

    @Data
    static class ReviewRequest {
        @NotNull
        private Long menuItemId;
        @NotNull
        private Long orderId;
        @NotNull @Min(1) @Max(5)
        private Integer rating;
        @Size(max = 1000)
        private String comment;
    }
}

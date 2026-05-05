package com.restaurant.controller;

import com.restaurant.dto.request.GuestSubmitReviewRequest;
import com.restaurant.dto.request.SubmitReviewRequest;
import com.restaurant.dto.request.UpdateReviewRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.review.EligibleOrderForReviewDto;
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

    @GetMapping("/reviews")
    @Operation(summary = "Danh sách tất cả đánh giá hiển thị (Public)")
    public ResponseEntity<ApiResponse<List<Review>>> listReviews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.listAllVisible(page, size)));
    }

    @GetMapping("/reviews/me")
    @Operation(summary = "Đánh giá của tôi (chỉnh sửa / xóa)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Review>>> myReviews(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return ResponseEntity.ok(ApiResponse.success(reviewService.listMyReviews(userId)));
    }

    @GetMapping("/reviews/me/eligible-orders")
    @Operation(summary = "Đơn hàng đủ điều kiện đánh giá (đã hoàn thành + đã thanh toán, chưa đánh giá)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<EligibleOrderForReviewDto>>> eligibleOrders(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return ResponseEntity.ok(ApiResponse.success(reviewService.listEligibleOrdersForReview(userId)));
    }

    @GetMapping("/reviews/guest/eligible-orders")
    @Operation(summary = "Khách vãng lai (QR): đơn đủ điều kiện (đã thanh toán, chưa đánh giá, đúng bàn theo mã QR)")
    public ResponseEntity<ApiResponse<List<EligibleOrderForReviewDto>>> guestEligibleOrders(
            @RequestParam("qrCodeToken") String qrCodeToken) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.listEligibleGuestOrdersForReview(qrCodeToken)));
    }

    @GetMapping("/reviews/guest/mine")
    @Operation(summary = "Khách vãng lai: đánh giá đã gửi từ bàn này (cùng mã QR) — sửa/xóa cũng cần mã")
    public ResponseEntity<ApiResponse<List<Review>>> guestMyReviews(
            @RequestParam("qrCodeToken") String qrCodeToken) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.listGuestReviewsForTable(qrCodeToken)));
    }

    @PostMapping("/reviews/guest")
    @Operation(summary = "Gửi đánh giá khách vãng lai (kèm mã QR bàn; đơn đã thanh toán, một lần/đơn)")
    public ResponseEntity<ApiResponse<Review>> guestSubmit(@Valid @RequestBody GuestSubmitReviewRequest request) {
        Review saved = reviewService.submitGuestReview(request);
        return ResponseEntity.ok(ApiResponse.success(saved, "Đánh giá thành công"));
    }

    @PutMapping("/reviews/guest/{id}")
    @Operation(summary = "Cập nhật đánh giá khách (cùng mã QR bàn với đơn)")
    public ResponseEntity<ApiResponse<Review>> guestUpdate(
            @PathVariable Long id,
            @RequestParam("qrCodeToken") String qrCodeToken,
            @Valid @RequestBody UpdateReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                reviewService.updateGuestReview(id, qrCodeToken, request), "Đã cập nhật đánh giá"));
    }

    @DeleteMapping("/reviews/guest/{id}")
    @Operation(summary = "Xóa đánh giá khách (cùng mã QR bàn với đơn)")
    public ResponseEntity<ApiResponse<Void>> guestDelete(
            @PathVariable Long id,
            @RequestParam("qrCodeToken") String qrCodeToken) {
        reviewService.deleteGuestReview(id, qrCodeToken);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa đánh giá"));
    }

    @PostMapping("/reviews")
    @Operation(summary = "Gửi đánh giá món ăn (sau khi đơn hoàn thành & thanh toán)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Review>> submitReview(
            Authentication authentication,
            @Valid @RequestBody SubmitReviewRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        Review saved = reviewService.submitReview(userId, request);
        return ResponseEntity.ok(ApiResponse.success(saved, "Đánh giá thành công"));
    }

    @PutMapping("/reviews/{id}")
    @Operation(summary = "Cập nhật đánh giá của chính mình", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Review>> updateMyReview(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody UpdateReviewRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        Review saved = reviewService.updateMyReview(userId, id, request);
        return ResponseEntity.ok(ApiResponse.success(saved, "Đã cập nhật đánh giá"));
    }

    @DeleteMapping("/reviews/{id}")
    @Operation(summary = "Xóa đánh giá của chính mình", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteMyReview(
            Authentication authentication,
            @PathVariable Long id) {
        Long userId = Long.parseLong(authentication.getName());
        reviewService.deleteMyReview(userId, id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa đánh giá"));
    }
}

package com.restaurant.controller;

import com.restaurant.dto.request.OrderRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.order.GuestOrderResponse;
import com.restaurant.dto.response.order.StaffOrderDetailResponse;
import com.restaurant.dto.response.order.StaffOrderResponse;
import com.restaurant.entity.Order;
import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.entity.enums.PaymentMethod;
import com.restaurant.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Order", description = "Quản lý đơn hàng")
public class OrderController {

    private final OrderService orderService;

    // ===== PUBLIC: Khách vãng lai đặt món qua QR =====
    @PostMapping("/orders/guest")
    @Operation(summary = "Đặt món (khách quét QR - không cần đăng nhập)")
    public ResponseEntity<ApiResponse<GuestOrderResponse>> createGuestOrder(@Valid @RequestBody OrderRequest request) {
        GuestOrderResponse order = orderService.createGuestOrderResponse(request);
        return ResponseEntity.ok(ApiResponse.success(order, "Đặt món thành công! Đơn hàng đang được xử lý."));
    }

    @GetMapping("/orders/guest/table/{qrToken}")
    @Operation(summary = "Xem trạng thái đơn hàng theo bàn (khách vãng lai - US04)")
    public ResponseEntity<ApiResponse<List<GuestOrderResponse>>> getOrdersByQrToken(@PathVariable String qrToken) {
        List<GuestOrderResponse> orders = orderService.getActiveOrderSummariesByQrToken(qrToken);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }

    // ===== AUTHENTICATED: Khách đăng nhập đặt món =====
    @PostMapping("/orders")
    @Operation(summary = "Đặt món (khách đã đăng nhập)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Order>> createOrder(
            @Valid @RequestBody OrderRequest request,
            Authentication authentication) {
        // Lấy userId từ JWT thay vì request body
        Long userId = orderService.getUserIdFromAuth(authentication);
        request.setUserId(userId);
        Order order = orderService.createOrder(request);
        return ResponseEntity.ok(ApiResponse.success(order, "Đặt món thành công"));
    }

    @GetMapping("/orders/me")
    @Operation(summary = "Lịch sử đơn hàng của tôi (US08)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<GuestOrderResponse>>> getMyOrders(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Long userId = orderService.getUserIdFromAuth(authentication);
        Page<GuestOrderResponse> orders = orderService.getUserOrderResponses(
                userId, PageRequest.of(page, Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending()));
        return ResponseEntity.ok(ApiResponse.success(orders));
    }

    @GetMapping("/orders/me/{orderId}")
    @Operation(summary = "Chi tiết đơn hàng của tôi", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<StaffOrderDetailResponse>> getMyOrderDetail(
            @PathVariable Long orderId,
            Authentication authentication) {
        Long userId = orderService.getUserIdFromAuth(authentication);
        return ResponseEntity.ok(ApiResponse.success(orderService.getCustomerOrderDetail(orderId, userId)));
    }

    // ===== STAFF: Quản lý đơn hàng =====
    @GetMapping("/staff/orders")
    @Operation(summary = "Nhân viên: Xem tất cả đơn hàng đang chờ", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<StaffOrderResponse>>> getAllActiveOrders() {
        return ResponseEntity.ok(ApiResponse.success(orderService.getAllActiveOrderSummaries()));
    }

    @GetMapping("/staff/orders/table/{tableId}")
    @Operation(summary = "Nhân viên: Xem đơn hàng theo bàn", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<StaffOrderResponse>>> getOrdersByTable(@PathVariable Long tableId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getActiveOrderSummariesByTable(tableId)));
    }

    @GetMapping("/staff/orders/paid-recent")
    @Operation(summary = "Nhân viên: Đơn đã thanh toán gần đây (lịch sử thu)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<StaffOrderResponse>>> getPaidRecentOrders(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getRecentPaidOrderSummaries(limit)));
    }

    @GetMapping("/staff/orders/{orderId}")
    @Operation(summary = "Nhân viên: Chi tiết đơn hàng (kèm dòng món)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<StaffOrderDetailResponse>> getStaffOrderDetail(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getStaffOrderDetail(orderId)));
    }

    @GetMapping("/staff/payments/today-revenue")
    @Operation(summary = "Nhân viên: Doanh thu hôm nay (đơn đã PAID)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTodayRevenueStaff() {
        return ResponseEntity.ok(ApiResponse.success(orderService.getTodayRevenueForStaff()));
    }

    @PatchMapping("/staff/orders/{orderId}/status")
    @Operation(summary = "Nhân viên: Cập nhật trạng thái đơn hàng", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<StaffOrderResponse>> updateOrderStatus(
            @PathVariable Long orderId,
            @RequestParam OrderStatus status) {
        StaffOrderResponse summary = orderService.updateOrderStatusAndSummarize(orderId, status);
        return ResponseEntity.ok(ApiResponse.success(summary, "Cập nhật trạng thái thành công"));
    }

    @PatchMapping("/staff/orders/{orderId}/payment")
    @Operation(summary = "Nhân viên: Xác nhận thanh toán", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<StaffOrderResponse>> processPayment(
            @PathVariable Long orderId,
            @RequestParam PaymentMethod method) {
        StaffOrderResponse summary = orderService.processPaymentAndSummarize(orderId, method);
        return ResponseEntity.ok(ApiResponse.success(summary, "Thanh toán thành công"));
    }
}

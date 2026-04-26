package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.CallStaffResponse;
import com.restaurant.entity.CallStaff;
import com.restaurant.entity.OrderItem;
import com.restaurant.entity.enums.OrderItemStatus;
import com.restaurant.service.StaffOperationsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Staff", description = "Nghiệp vụ nhân viên phục vụ")
@SecurityRequirement(name = "bearerAuth")
public class StaffController {

    private final StaffOperationsService staffOperationsService;

    @PatchMapping("/staff/order-items/{itemId}/status")
    @Operation(summary = "Cập nhật trạng thái từng món (PREPARING → READY → SERVED)")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<OrderItem>> updateItemStatus(
            @PathVariable Long itemId,
            @RequestParam OrderItemStatus status) {
        OrderItem item = staffOperationsService.updateOrderItemStatus(itemId, status);
        return ResponseEntity.ok(ApiResponse.success(item, "Cập nhật trạng thái món thành công"));
    }

    @GetMapping("/staff/call-staff")
    @Operation(summary = "Xem danh sách bàn đang gọi nhân viên")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<CallStaffResponse>>> getPendingCalls() {
        return ResponseEntity.ok(ApiResponse.success(staffOperationsService.getPendingCallStaffResponses()));
    }

    @PatchMapping("/staff/call-staff/{id}/resolve")
    @Operation(summary = "Đánh dấu đã xử lý yêu cầu gọi nhân viên")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<CallStaffResponse>> resolveCall(@PathVariable Long id) {
        CallStaffResponse dto = staffOperationsService.resolveCallStaffRequestReturningDto(id);
        return ResponseEntity.ok(ApiResponse.success(dto, "Đã xử lý yêu cầu"));
    }

    @PostMapping("/tables/qr/{token}/call-staff")
    @Operation(summary = "Khách gọi nhân viên qua QR (Public)", tags = "Table")
    public ResponseEntity<ApiResponse<CallStaffResponse>> callStaff(
            @PathVariable String token,
            @RequestParam(required = false) String note) {
        CallStaff saved = staffOperationsService.createGuestCallStaffRequest(token, note);
        return ResponseEntity.ok(ApiResponse.success(
                staffOperationsService.toCallStaffResponse(saved),
                "Đã gọi nhân viên, vui lòng chờ!"));
    }
}

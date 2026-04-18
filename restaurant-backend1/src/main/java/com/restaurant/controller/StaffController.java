package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.entity.CallStaff;
import com.restaurant.entity.OrderItem;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.OrderItemStatus;
import com.restaurant.repository.CallStaffRepository;
import com.restaurant.repository.OrderItemRepository;
import com.restaurant.service.TableService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Staff", description = "Nghiệp vụ nhân viên phục vụ")
@SecurityRequirement(name = "bearerAuth")
public class StaffController {

    private final OrderItemRepository orderItemRepository;
    private final CallStaffRepository callStaffRepository;
    private final TableService tableService;
    private final SimpMessagingTemplate messagingTemplate;

    @PatchMapping("/staff/order-items/{itemId}/status")
    @Operation(summary = "Cập nhật trạng thái từng món (PREPARING → READY → SERVED)")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<OrderItem>> updateItemStatus(
            @PathVariable Long itemId,
            @RequestParam OrderItemStatus status) {
        OrderItem item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy món"));
        item.setStatus(status);
        orderItemRepository.save(item);
        // Notify via WebSocket
        messagingTemplate.convertAndSend(
                "/topic/orders/" + item.getOrder().getId() + "/items", item.getId());
        return ResponseEntity.ok(ApiResponse.success(item, "Cập nhật trạng thái món thành công"));
    }

    @GetMapping("/staff/call-staff")
    @Operation(summary = "Xem danh sách bàn đang gọi nhân viên")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<CallStaff>>> getPendingCalls() {
        return ResponseEntity.ok(ApiResponse.success(
                callStaffRepository.findByIsResolvedFalseOrderByCreatedAtAsc()));
    }

    @PatchMapping("/staff/call-staff/{id}/resolve")
    @Operation(summary = "Đánh dấu đã xử lý yêu cầu gọi nhân viên")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<CallStaff>> resolveCall(@PathVariable Long id) {
        CallStaff call = callStaffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy yêu cầu"));
        call.setIsResolved(true);
        call.setResolvedAt(LocalDateTime.now());
        callStaffRepository.save(call);
        return ResponseEntity.ok(ApiResponse.success(call, "Đã xử lý yêu cầu"));
    }

    // A2: Khách gọi nhân viên qua QR — lưu DB + push WebSocket (US02)
    @PostMapping("/tables/qr/{token}/call-staff")
    @Operation(summary = "Khách gọi nhân viên qua QR (Public)", tags = "Table")
    public ResponseEntity<ApiResponse<CallStaff>> callStaff(
            @PathVariable String token,
            @RequestParam(required = false) String note) {
        RestaurantTable table = tableService.getTableByQrToken(token);

        // Kiểm tra xem bàn này đã có yêu cầu chưa xử lý chưa (tránh spam)
        boolean alreadyCalling = callStaffRepository
                .findByTableIdAndIsResolvedFalseOrderByCreatedAtDesc(table.getId())
                .stream().findFirst().isPresent();
        if (alreadyCalling) {
            throw new IllegalStateException("Bàn này đã có yêu cầu gọi nhân viên đang chờ xử lý");
        }

        // Lưu vào DB
        CallStaff callStaff = CallStaff.builder()
                .table(table)
                .note(note)
                .isResolved(false)
                .build();
        CallStaff saved = callStaffRepository.save(callStaff);

        // Push WebSocket đến nhân viên
        messagingTemplate.convertAndSend("/topic/staff/call",
                java.util.Map.of(
                        "tableId", table.getId(),
                        "tableNumber", table.getTableNumber(),
                        "callId", saved.getId(),
                        "note", note != null ? note : ""
                ));

        return ResponseEntity.ok(ApiResponse.success(saved, "Đã gọi nhân viên, vui lòng chờ!"));
    }
}

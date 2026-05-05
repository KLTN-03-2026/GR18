package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.RestaurantTableResponse;
import com.restaurant.dto.response.TableBookingOptionsResponse;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.TableStatus;
import com.restaurant.service.TableService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tables")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "Table", description = "Quản lý bàn và mã QR")
public class TableController {

    private final TableService tableService;

    @GetMapping("/qr/{token}")
    @Operation(summary = "Quét mã QR → lấy thông tin bàn và menu (Public)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> scanQrCode(@PathVariable String token) {
        Map<String, Object> data = tableService.buildQrScanWelcomeData(token);
        return ResponseEntity.ok(ApiResponse.success(data, "Chào mừng bạn đến với nhà hàng!"));
    }

    @GetMapping("/booking-options")
    @Operation(summary = "Khu vực & danh sách bàn cho form đặt bàn (Public)")
    public ResponseEntity<ApiResponse<TableBookingOptionsResponse>> bookingOptions() {
        return ResponseEntity.ok(ApiResponse.success(tableService.getBookingOptionsForPublic()));
    }

    @PatchMapping("/staff/tables/{id}/status")
    @Operation(summary = "Nhân viên: Cập nhật trạng thái bàn", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantTableResponse>> updateStatus(
            @PathVariable Long id,
            @RequestParam TableStatus status) {
        RestaurantTable updated = tableService.updateTableStatus(id, status);
        return ResponseEntity.ok(ApiResponse.success(RestaurantTableResponse.from(updated)));
    }

    @GetMapping("/staff/tables")
    @Operation(summary = "Nhân viên/Admin: Danh sách bàn (trạng thái vận hành)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<RestaurantTableResponse>>> listTablesForStaff() {
        return ResponseEntity.ok(ApiResponse.success(tableService.getAllTableResponses()));
    }

    @GetMapping("/admin/tables")
    @Operation(summary = "Admin: Danh sách tất cả bàn (QR / sơ đồ)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<RestaurantTableResponse>>> listAllTablesForAdmin() {
        return ResponseEntity.ok(ApiResponse.success(tableService.getAllTableResponses()));
    }

    @PostMapping("/admin/tables")
    @Operation(summary = "Admin: Tạo bàn mới", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantTableResponse>> createTable(
            @RequestParam String tableNumber,
            @RequestParam Integer capacity,
            @RequestParam(required = false) String location) {
        RestaurantTable table = tableService.createTable(tableNumber, capacity, location);
        return ResponseEntity.ok(ApiResponse.success(RestaurantTableResponse.from(table), "Tạo bàn thành công"));
    }

    @PutMapping("/admin/tables/{id}")
    @Operation(summary = "Admin: Cập nhật thông tin bàn (US22)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantTableResponse>> updateTable(
            @PathVariable Long id,
            @RequestParam(required = false) Integer capacity,
            @RequestParam(required = false) String location) {
        RestaurantTable table = tableService.updateTableInfo(id, capacity, location);
        return ResponseEntity.ok(ApiResponse.success(RestaurantTableResponse.from(table), "Cập nhật bàn thành công"));
    }

    @DeleteMapping("/admin/tables/{id}")
    @Operation(summary = "Admin: Xóa bàn (soft delete) (US22)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteTable(@PathVariable Long id) {
        tableService.deleteTable(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa bàn"));
    }

    @PatchMapping("/admin/tables/{id}/deactivate-qr")
    @Operation(summary = "Admin: Vô hiệu hóa mã QR của bàn (US22)", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantTableResponse>> deactivateQr(@PathVariable Long id) {
        RestaurantTable table = tableService.regenerateQrCode(id);
        return ResponseEntity.ok(ApiResponse.success(
                RestaurantTableResponse.from(table), "Mã QR đã được tạo lại (QR cũ vô hiệu)"));
    }

    @GetMapping("/admin/tables/{id}/qr")
    @Operation(summary = "Admin: Tải xuống mã QR của bàn", security = @SecurityRequirement(name = "bearerAuth"))
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> downloadQrCode(@PathVariable Long id) {
        RestaurantTable table = tableService.getTableById(id);
        byte[] qrBytes = tableService.generateQrCode(table);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"table_" + table.getTableNumber() + "_qr.png\"")
                .body(qrBytes);
    }
}

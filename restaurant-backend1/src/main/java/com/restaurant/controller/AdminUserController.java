package com.restaurant.controller;

import com.restaurant.dto.request.CreateUserRequest;
import com.restaurant.dto.request.UpdateUserRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.UserResponse;
import com.restaurant.entity.enums.UserRole;
import com.restaurant.service.UserManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin - User Management", description = "Quản lý tài khoản người dùng")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserManagementService userManagementService;

    // ===== Create =====
    @PostMapping
    @Operation(summary = "Tạo tài khoản mới (Staff/Admin)")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ok(userManagementService.createUser(request), "Tạo tài khoản thành công");
    }

    // ===== Read =====
    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả user")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        return ok(userManagementService.getAllUsers());
    }

    @GetMapping("/paged")
    @Operation(summary = "Lấy danh sách user có phân trang")
    public ResponseEntity<ApiResponse<Page<UserResponse>>> getUsersPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ok(userManagementService.getUsersPage(page, size));
    }

    @GetMapping("/role/{role}")
    @Operation(summary = "Lấy danh sách user theo role")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getUsersByRole(@PathVariable UserRole role) {
        return ok(userManagementService.getUsersByRole(role));
    }

    @GetMapping("/role/{role}/paged")
    @Operation(summary = "Lấy danh sách user theo role có phân trang")
    public ResponseEntity<ApiResponse<Page<UserResponse>>> getUsersByRolePaged(
            @PathVariable UserRole role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ok(userManagementService.getUsersByRolePage(role, page, size));
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Lấy thông tin user theo ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Long userId) {
        return ok(userManagementService.getUserById(userId));
    }

    // ===== Update =====
    @PutMapping("/{userId}")
    @Operation(summary = "Cập nhật thông tin user")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserRequest request) {
        return ok(userManagementService.updateUser(userId, request), "Cập nhật thành công");
    }

    @PatchMapping("/{userId}/reset-password")
    @Operation(summary = "Reset password cho user")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @PathVariable Long userId,
            @RequestParam String newPassword) {
        userManagementService.resetPassword(userId, newPassword);
        return ok(null, "Reset password thành công");
    }

    @PatchMapping("/{userId}/toggle-status")
    @Operation(summary = "Kích hoạt / vô hiệu hóa tài khoản")
    public ResponseEntity<ApiResponse<Void>> toggleStatus(
            @PathVariable Long userId,
            @RequestParam boolean isActive) {
        userManagementService.toggleUserStatus(userId, isActive);
        return ok(null, isActive ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản");
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Xóa tài khoản (không xóa được nếu còn dữ liệu liên kết)")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @PathVariable Long userId,
            Authentication authentication) {
        Long actingAdminId = parseUserId(authentication);
        userManagementService.deleteUser(userId, actingAdminId);
        return ok(null, "Đã xóa tài khoản");
    }

    private static Long parseUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    private static <T> ResponseEntity<ApiResponse<T>> ok(T data, String message) {
        return ResponseEntity.ok(ApiResponse.success(data, message));
    }
}


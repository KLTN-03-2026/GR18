package com.restaurant.controller;

import com.restaurant.dto.request.CreateUserRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.UserResponse;
import com.restaurant.entity.enums.UserRole;
import com.restaurant.service.UserManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin - User Management", description = "Quản lý tài khoản người dùng")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserManagementService userManagementService;

    @PostMapping
    @Operation(summary = "Tạo tài khoản mới (Staff/Admin)")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userManagementService.createUser(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Tạo tài khoản thành công"));
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả user")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        List<UserResponse> users = userManagementService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    @GetMapping("/role/{role}")
    @Operation(summary = "Lấy danh sách user theo role")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getUsersByRole(@PathVariable UserRole role) {
        List<UserResponse> users = userManagementService.getUsersByRole(role);
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Lấy thông tin user theo ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Long userId) {
        UserResponse user = userManagementService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PutMapping("/{userId}")
    @Operation(summary = "Cập nhật thông tin user")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable Long userId,
            @Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userManagementService.updateUser(userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Cập nhật thành công"));
    }

    @PatchMapping("/{userId}/reset-password")
    @Operation(summary = "Reset password cho user")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @PathVariable Long userId,
            @RequestParam String newPassword) {
        userManagementService.resetPassword(userId, newPassword);
        return ResponseEntity.ok(ApiResponse.success(null, "Reset password thành công"));
    }

    @PatchMapping("/{userId}/toggle-status")
    @Operation(summary = "Kích hoạt / vô hiệu hóa tài khoản")
    public ResponseEntity<ApiResponse<Void>> toggleStatus(
            @PathVariable Long userId,
            @RequestParam boolean isActive) {
        userManagementService.toggleUserStatus(userId, isActive);
        return ResponseEntity.ok(ApiResponse.success(null, 
                isActive ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản"));
    }
}


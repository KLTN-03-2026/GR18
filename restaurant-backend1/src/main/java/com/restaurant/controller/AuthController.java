package com.restaurant.controller;

import com.restaurant.dto.request.LoginRequest;
import com.restaurant.dto.request.RegisterRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.AuthResponse;
import com.restaurant.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Đăng ký, Đăng nhập, Refresh Token")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản khách hàng")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Đăng ký thành công"));
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập (email hoặc số điện thoại)")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Đăng nhập thành công"));

    }

    @PostMapping("/google")
    @Operation(summary = "Đăng nhập bằng Google ID Token")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(@RequestBody Map<String, String> request) {
        AuthResponse response = authService.loginWithGoogleRequest(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Đăng nhập Google thành công"));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Làm mới Access Token")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@RequestParam String refreshToken) {
        AuthResponse response = authService.refreshToken(refreshToken);
        return ResponseEntity.ok(ApiResponse.success(response, "Làm mới token thành công"));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            Authentication authentication,
            @RequestHeader("Authorization") String authHeader) {
        authService.logout(authentication, authHeader);
        return ResponseEntity.ok(ApiResponse.success(null, "Đăng xuất thành công"));
    }

}

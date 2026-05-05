package com.restaurant.controller;

import com.restaurant.dto.request.UpdateCustomerPhoneRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/customer")
@RequiredArgsConstructor
@Tag(name = "Customer profile", description = "Khách hàng cập nhật thông tin cá nhân")
public class CustomerProfileController {

    private final AuthService authService;

    @PatchMapping("/profile/phone")
    @Operation(summary = "Cập nhật số điện thoại (10 chữ số, duy nhất)")
    public ResponseEntity<ApiResponse<Map<String, String>>> updateMyPhone(
            Authentication authentication,
            @Valid @RequestBody UpdateCustomerPhoneRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        String phone = authService.updateCustomerPhone(userId, request.getPhone());
        return ResponseEntity.ok(
                ApiResponse.success(
                        Collections.singletonMap("phone", phone),
                        "Đã cập nhật số điện thoại"));
    }
}

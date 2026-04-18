package com.restaurant.controller;

import com.restaurant.dto.request.GuestCallStaffRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.service.GuestSupportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/call-staff")
@RequiredArgsConstructor
public class GuestSupportController {

    private final GuestSupportService guestSupportService;

    @PostMapping("/guest")
    public ResponseEntity<ApiResponse<Void>> callStaff(@Valid @RequestBody GuestCallStaffRequest req) {
        boolean ok = guestSupportService.createCallStaffByQrToken(req.getQrToken(), req.getNote());
        if (!ok) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Mã QR bàn không hợp lệ."));
        }
        return ResponseEntity.ok(ApiResponse.success(null, "Đã gửi yêu cầu hỗ trợ tới nhân viên"));
    }
}


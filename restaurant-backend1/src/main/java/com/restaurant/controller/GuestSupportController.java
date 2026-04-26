package com.restaurant.controller;

import com.restaurant.dto.request.GuestCallStaffRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.service.StaffOperationsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/call-staff")
@RequiredArgsConstructor
public class GuestSupportController {

    private final StaffOperationsService staffOperationsService;

    @PostMapping("/guest")
    public ResponseEntity<ApiResponse<Void>> callStaff(@Valid @RequestBody GuestCallStaffRequest req) {
        try {
            staffOperationsService.createGuestCallStaffRequest(req.getQrToken(), req.getNote());
            return ResponseEntity.ok(ApiResponse.success(null, "Đã gửi yêu cầu hỗ trợ tới nhân viên"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ApiResponse.error(ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(ex.getMessage()));
        }
    }
}

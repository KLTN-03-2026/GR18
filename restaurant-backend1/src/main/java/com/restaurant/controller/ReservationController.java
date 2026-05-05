package com.restaurant.controller;

import com.restaurant.dto.request.CreateReservationRequest;
import com.restaurant.dto.request.UpdateReservationRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.PageResponse;
import com.restaurant.dto.response.ReservationHistoryItemResponse;
import com.restaurant.service.ReservationService;
import jakarta.validation.Valid;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequestMapping("/reservations")
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationService reservationService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ReservationHistoryItemResponse>> createReservation(
            @Valid @RequestBody CreateReservationRequest req,
            Principal principal
    ) {
        ReservationHistoryItemResponse data = reservationService.createReservation(req, principal);
        if (data == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Không xác định được người dùng."));
        }
        return ResponseEntity.ok(ApiResponse.success(data, "Đặt bàn thành công"));
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<ReservationHistoryItemResponse>>> getMyReservations(
            Principal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        PageResponse<ReservationHistoryItemResponse> data = reservationService.getMyReservations(principal, page, size);
        if (data == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Không xác định được người dùng."));
        }
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @DeleteMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> cancelReservation(@PathVariable Long id, Principal principal) {
        boolean ok = reservationService.cancelReservation(id, principal);
        if (!ok) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Không thể hủy đặt bàn này."));
        }
        return ResponseEntity.ok(ApiResponse.success(null, "Đã hủy đặt bàn"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> updateReservation(
            @PathVariable Long id,
            @RequestBody UpdateReservationRequest req
    ) {
        boolean ok = reservationService.updateReservationByStaff(id, req);
        if (!ok) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Không tìm thấy đơn để cập nhật."));
        }
        return ResponseEntity.ok(ApiResponse.success(null, "Cập nhật đặt bàn thành công"));
    }
}
package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.ReservationHistoryItemResponse;
import com.restaurant.service.ReservationService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/staff/reservations")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class StaffReservationController {

    private final ReservationService reservationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ReservationHistoryItemResponse>>> getReservationsByDate(
            @RequestParam(required = false) LocalDate date
    ) {
        List<ReservationHistoryItemResponse> data = reservationService.getReservationsForDateForStaff(date);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @GetMapping("/today")
    public ResponseEntity<ApiResponse<List<ReservationHistoryItemResponse>>> getTodayReservations() {
        List<ReservationHistoryItemResponse> data = reservationService.getTodayReservationsForStaff();
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @PatchMapping("/{id}/confirm")
    public ResponseEntity<ApiResponse<Void>> confirmReservation(@PathVariable Long id) {
        reservationService.confirmReservationByStaffOrThrow(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xác nhận đặt bàn"));
    }

    @PatchMapping("/{id}/arrived")
    public ResponseEntity<ApiResponse<Void>> arrivedReservation(@PathVariable Long id) {
        reservationService.markArrivedByStaffOrThrow(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã cập nhật khách đã đến"));
    }

    @PatchMapping("/{id}/complete")
    public ResponseEntity<ApiResponse<Void>> completeReservation(@PathVariable Long id) {
        reservationService.completeReservationByStaffOrThrow(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã hoàn thành đặt bàn"));
    }
}

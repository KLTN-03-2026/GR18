package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/statistics")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Statistics", description = "Thống kê doanh thu (Admin & Staff)")
public class StatisticsController {

    private final StatisticsService statisticsService;

    @GetMapping("/revenue")
    @Operation(summary = "Doanh thu theo khoảng thời gian")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRevenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(ApiResponse.success(statisticsService.getRevenue(start, end)));
    }

    @GetMapping("/top-selling")
    @Operation(summary = "Top món ăn bán chạy nhất")
    public ResponseEntity<ApiResponse<List<Object[]>>> getTopSelling(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(ApiResponse.success(statisticsService.getTopSellingMenuItems(limit)));
    }

    @GetMapping("/overview")
    @Operation(summary = "Tổng quan hoạt động nhà hàng hôm nay")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getOverview() {
        return ResponseEntity.ok(ApiResponse.success(statisticsService.getTodayOverview()));
    }
}

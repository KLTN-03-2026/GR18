package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.repository.OrderItemRepository;
import com.restaurant.repository.OrderRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/statistics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Statistics", description = "Thống kê và báo cáo doanh thu (Admin)")
public class StatisticsController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    @GetMapping("/revenue")
    @Operation(summary = "Doanh thu theo khoảng thời gian")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRevenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        BigDecimal total = orderRepository.sumRevenueByDateRange(start, end);
        List<Object[]> daily = orderRepository.getDailyRevenue(start, end);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "totalRevenue", total,
                "dailyBreakdown", daily,
                "period", Map.of("from", start, "to", end)
        )));
    }

    @GetMapping("/top-selling")
    @Operation(summary = "Top món ăn bán chạy nhất")
    public ResponseEntity<ApiResponse<List<Object[]>>> getTopSelling(
            @RequestParam(defaultValue = "10") int limit) {
        List<Object[]> items = orderItemRepository.findTopSellingMenuItems(PageRequest.of(0, limit));
        return ResponseEntity.ok(ApiResponse.success(items));
    }

    @GetMapping("/overview")
    @Operation(summary = "Tổng quan hoạt động nhà hàng hôm nay")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getOverview() {
        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime now = LocalDateTime.now();
        BigDecimal todayRevenue = orderRepository.sumRevenueByDateRange(startOfDay, now);

        // R7: Dùng count query thay vì load toàn bộ đơn hàng vào RAM
        long pendingOrders = orderRepository.countByStatusIn(
                List.of(com.restaurant.entity.enums.OrderStatus.PENDING,
                        com.restaurant.entity.enums.OrderStatus.PREPARING,
                        com.restaurant.entity.enums.OrderStatus.SERVING));

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "todayRevenue", todayRevenue,
                "pendingOrders", pendingOrders
        )));
    }
}

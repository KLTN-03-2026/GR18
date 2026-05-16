package com.restaurant.service;

import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.repository.OrderItemRepository;
import com.restaurant.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatisticsService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public Map<String, Object> getRevenue(LocalDateTime start, LocalDateTime end) {
        BigDecimal total = orderRepository.sumRevenueByDateRange(start, end);
        List<Object[]> daily = orderRepository.getDailyRevenue(start, end);
        return Map.of(
                "totalRevenue", total,
                "dailyBreakdown", daily,
                "period", Map.of("from", start, "to", end)
        );
    }

    public List<Object[]> getTopSellingMenuItems(int limit) {
        return orderItemRepository.findTopSellingMenuItems(PageRequest.of(0, limit));
    }

    public Map<String, Object> getTodayOverview() {
        return getOverviewForDate(LocalDate.now());
    }

    /** Tổng quan theo một ngày (mặc định hôm nay). Ngày quá khứ: không có đơn đang xử lý realtime. */
    public Map<String, Object> getOverviewForDate(LocalDate date) {
        LocalDate target = date != null ? date : LocalDate.now();
        boolean isToday = target.equals(LocalDate.now());
        LocalDateTime startOfDay = target.atStartOfDay();
        LocalDateTime end = isToday ? LocalDateTime.now() : target.atTime(23, 59, 59);

        BigDecimal dayRevenue = orderRepository.sumRevenueByDateRange(startOfDay, end);
        long ordersPaid = orderRepository.countPaidOrdersBetween(startOfDay, end);
        long pendingOrders = isToday
                ? orderRepository.countByStatusIn(
                        List.of(OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.SERVING))
                : 0L;

        return Map.of(
                "selectedDate", target.toString(),
                "isToday", isToday,
                "todayRevenue", dayRevenue,
                "pendingOrders", pendingOrders,
                "ordersPaidToday", ordersPaid
        );
    }
}

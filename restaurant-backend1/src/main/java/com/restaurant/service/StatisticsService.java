package com.restaurant.service;

import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.repository.OrderItemRepository;
import com.restaurant.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime now = LocalDateTime.now();
        BigDecimal todayRevenue = orderRepository.sumRevenueByDateRange(startOfDay, now);
        long pendingOrders = orderRepository.countByStatusIn(
                List.of(OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.SERVING));
        return Map.of(
                "todayRevenue", todayRevenue,
                "pendingOrders", pendingOrders
        );
    }
}

package com.restaurant.service;

import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.repository.OrderItemRepository;
import com.restaurant.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatisticsServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @InjectMocks
    private StatisticsService statisticsService;

    @Test
    void getOverviewForDate_usesFullDayForPastDate() {
        LocalDate past = LocalDate.of(2026, 5, 10);
        when(orderRepository.sumRevenueByDateRange(any(), any())).thenReturn(BigDecimal.valueOf(500_000));
        when(orderRepository.countPaidOrdersBetween(any(), any())).thenReturn(3L);

        Map<String, Object> result = statisticsService.getOverviewForDate(past);

        assertThat(result.get("selectedDate")).isEqualTo("2026-05-10");
        assertThat(result.get("isToday")).isEqualTo(false);
        assertThat(result.get("todayRevenue")).isEqualTo(BigDecimal.valueOf(500_000));
        assertThat(result.get("ordersPaidToday")).isEqualTo(3L);
        assertThat(result.get("pendingOrders")).isEqualTo(0L);

        verify(orderRepository).sumRevenueByDateRange(
                eq(past.atStartOfDay()),
                eq(past.atTime(23, 59, 59)));
    }

    @Test
    void getOverviewForDate_todayIncludesPendingQueue() {
        LocalDate today = LocalDate.now();
        when(orderRepository.sumRevenueByDateRange(any(), any())).thenReturn(BigDecimal.ZERO);
        when(orderRepository.countPaidOrdersBetween(any(), any())).thenReturn(0L);
        when(orderRepository.countByStatusIn(
                eq(List.of(OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.SERVING))))
                .thenReturn(5L);

        Map<String, Object> result = statisticsService.getOverviewForDate(today);

        assertThat(result.get("isToday")).isEqualTo(true);
        assertThat(result.get("pendingOrders")).isEqualTo(5L);
    }
}

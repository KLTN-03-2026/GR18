package com.restaurant.repository;

import com.restaurant.entity.Order;
import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.entity.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByTableId(Long tableId);
    List<Order> findByTableIdAndStatus(Long tableId, OrderStatus status);
    List<Order> findByUserId(Long userId);
    Page<Order> findByUserId(Long userId, Pageable pageable);
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByStatusIn(List<OrderStatus> statuses);   // R10: lấy nhiều trạng thái
    List<Order> findByPaymentStatus(PaymentStatus paymentStatus);

    Page<Order> findByStatusAndPaymentStatus(OrderStatus status, PaymentStatus paymentStatus, Pageable pageable);

    @Query("""
        SELECT DISTINCT o FROM Order o
        LEFT JOIN FETCH o.table
        LEFT JOIN FETCH o.user
        LEFT JOIN FETCH o.orderItems oi
        LEFT JOIN FETCH oi.menuItem
        WHERE o.id = :id
    """)
    Optional<Order> findDetailById(@Param("id") Long id);

    @Query("""
        SELECT o FROM Order o
        WHERE o.table.id = :tableId
        AND o.status NOT IN ('COMPLETED', 'CANCELLED')
        ORDER BY o.createdAt DESC
    """)
    List<Order> findActiveOrdersByTable(@Param("tableId") Long tableId);

    @Query("""
        SELECT COALESCE(SUM(o.totalAmount), 0)
        FROM Order o
        WHERE o.paymentStatus = 'PAID'
        AND o.paidAt BETWEEN :start AND :end
    """)
    BigDecimal sumRevenueByDateRange(@Param("start") LocalDateTime start,
                                     @Param("end") LocalDateTime end);

    @Query("""
        SELECT DATE(o.paidAt) as date, SUM(o.totalAmount) as revenue
        FROM Order o
        WHERE o.paymentStatus = 'PAID'
        AND o.paidAt BETWEEN :start AND :end
        GROUP BY DATE(o.paidAt)
        ORDER BY DATE(o.paidAt)
    """)
    List<Object[]> getDailyRevenue(@Param("start") LocalDateTime start,
                                    @Param("end") LocalDateTime end);

    // R7: Count query — tránh load toàn bộ Order vào RAM
    long countByStatus(OrderStatus status);
    long countByStatusIn(List<OrderStatus> statuses);

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.paymentStatus = 'PAID'
            AND o.paidAt BETWEEN :start AND :end
            """)
    long countPaidOrdersBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** Đơn hoàn thành + đã thanh toán (để kiểm tra quyền đánh giá). */
    @Query("""
            SELECT o FROM Order o
            JOIN FETCH o.orderItems oi
            JOIN FETCH oi.menuItem mi
            LEFT JOIN FETCH o.table
            WHERE o.user.id = :userId
            AND o.status = 'COMPLETED'
            AND o.paymentStatus = 'PAID'
            ORDER BY o.paidAt DESC
            """)
    List<Order> findCompletedPaidWithItemsByUserId(@Param("userId") Long userId);

    /** Đơn khách vãng lai (không user) tại bàn: hoàn tất + đã thanh toán. */
    @Query("""
            SELECT o FROM Order o
            JOIN FETCH o.orderItems oi
            JOIN FETCH oi.menuItem mi
            JOIN FETCH o.table t
            WHERE t.id = :tableId
            AND o.user IS NULL
            AND o.status = 'COMPLETED'
            AND o.paymentStatus = 'PAID'
            ORDER BY o.paidAt DESC
            """)
    List<Order> findCompletedPaidGuestOrdersByTableId(@Param("tableId") Long tableId);
}

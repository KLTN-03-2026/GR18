package com.restaurant.repository;

import com.restaurant.entity.OrderItem;
import com.restaurant.entity.enums.OrderItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {
    List<OrderItem> findByOrderId(Long orderId);
    List<OrderItem> findByOrderIdAndStatus(Long orderId, OrderItemStatus status);

    @Query("""
        SELECT oi.menuItem.id, oi.menuItem.name, SUM(oi.quantity) as totalQty
        FROM OrderItem oi
        WHERE oi.order.paymentStatus = 'PAID'
        GROUP BY oi.menuItem.id, oi.menuItem.name
        ORDER BY totalQty DESC
    """)
    List<Object[]> findTopSellingMenuItems(org.springframework.data.domain.Pageable pageable);

    @Query("""
        SELECT oi.menuItem.id FROM OrderItem oi
        WHERE oi.order.user.id = :userId
        GROUP BY oi.menuItem.id
        ORDER BY SUM(oi.quantity) DESC
    """)
    List<Long> findFavoriteMenuItemIdsByUser(@Param("userId") Long userId,
                                              org.springframework.data.domain.Pageable pageable);
}

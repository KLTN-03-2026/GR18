package com.restaurant.repository;

import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.TableStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {
    List<RestaurantTable> findByStatus(TableStatus status);
    List<RestaurantTable> findByIsActiveTrue();
    Optional<RestaurantTable> findByTableNumber(String tableNumber);
    Optional<RestaurantTable> findByQrCodeToken(String token);
    List<RestaurantTable> findByCapacityGreaterThanEqualAndIsActiveTrue(Integer capacity);

    @Query("""
        SELECT t FROM RestaurantTable t
        WHERE t.isActive = true
        AND t.id NOT IN (
            SELECT r.table.id FROM Reservation r
            WHERE r.status IN ('CONFIRMED', 'ARRIVED')
            AND r.reservationTime BETWEEN :start AND :end
        )
        AND t.capacity >= :guests
        ORDER BY t.capacity ASC
    """)
    List<RestaurantTable> findAvailableTablesForReservation(
            LocalDateTime start, LocalDateTime end, Integer guests);
}

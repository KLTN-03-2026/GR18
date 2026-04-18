package com.restaurant.repository;

import com.restaurant.entity.Reservation;
import com.restaurant.entity.enums.ReservationStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByUserId(Long userId);

    Page<Reservation> findByUserId(Long userId, Pageable pageable);

    List<Reservation> findByStatus(ReservationStatus status);

    List<Reservation> findByTableIdAndStatus(Long tableId, ReservationStatus status);

    @Query("""
        SELECT COUNT(r)
        FROM Reservation r
        WHERE r.user.id = :userId
          AND r.reservationTime BETWEEN :start AND :end
    """)
    long countByUserIdAndDate(
            @Param("userId") Long userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Query("""
        SELECT r FROM Reservation r
        WHERE r.reservationTime BETWEEN :start AND :end
        ORDER BY r.reservationTime ASC
    """)
    List<Reservation> findByDate(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Query("""
    SELECT r FROM Reservation r
    WHERE r.table.id = :tableId
    AND r.status IN ('PENDING', 'CONFIRMED', 'ARRIVED')
    AND r.reservationTime BETWEEN :start AND :end
""")
    List<Reservation> findConflictingReservations(
            @Param("tableId") Long tableId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}
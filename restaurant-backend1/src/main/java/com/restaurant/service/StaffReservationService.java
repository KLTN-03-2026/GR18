package com.restaurant.service;

import com.restaurant.dto.response.ReservationHistoryItemResponse;
import com.restaurant.mapper.ReservationHistoryItemMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StaffReservationService {

    private final JdbcTemplate jdbcTemplate;
    private final ReservationHistoryItemMapper mapper;

    public List<ReservationHistoryItemResponse> getTodayReservations() {
        return jdbcTemplate.query(
                "SELECT r.id, r.table_id, r.reservation_time, r.number_of_guests, r.customer_name, r.customer_phone, r.status, " +
                        "rt.table_number, rt.location AS table_location, r.note " +
                        "FROM reservations r " +
                        "LEFT JOIN restaurant_tables rt ON rt.id = r.table_id " +
                        "WHERE DATE(r.reservation_time) = CURDATE() " +
                        "ORDER BY r.reservation_time ASC",
                (rs, i) -> mapper.fromResultSet(rs)
        );
    }

    @Transactional
    public boolean updateStatus(Long id, String status) {
        int updated = jdbcTemplate.update(
                "UPDATE reservations SET status = ?, updated_at = NOW() WHERE id = ?",
                status, id
        );
        return updated > 0;
    }
}


package com.restaurant.mapper;

import com.restaurant.dto.response.ReservationHistoryItemResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

@Component
public class ReservationHistoryItemMapper {

    public ReservationHistoryItemResponse fromResultSet(ResultSet rs) throws SQLException {
        long tableIdRaw = rs.getLong("table_id");
        return ReservationHistoryItemResponse.builder()
                .id(rs.getLong("id"))
                .tableId(rs.wasNull() ? null : tableIdRaw)
                .reservationTime(toLocalDateTime(rs.getTimestamp("reservation_time")))
                .numberOfGuests(rs.getInt("number_of_guests"))
                .customerName(rs.getString("customer_name"))
                .customerPhone(rs.getString("customer_phone"))
                .status(rs.getString("status"))
                .tableNumber(rs.getString("table_number"))
                .note(rs.getString("note"))
                .build();
    }

    private LocalDateTime toLocalDateTime(Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }
}


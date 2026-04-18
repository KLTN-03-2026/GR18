package com.restaurant.service;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GuestSupportService {

    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public boolean createCallStaffByQrToken(String qrToken, String note) {
        List<Long> ids = jdbcTemplate.query(
                "SELECT id FROM restaurant_tables WHERE qr_code_token = ? AND is_active = 1 LIMIT 1",
                (rs, i) -> rs.getLong("id"),
                qrToken
        );
        Long tableId = ids.isEmpty() ? null : ids.get(0);
        if (tableId == null) return false;
        jdbcTemplate.update(
                "INSERT INTO call_staffs(table_id, is_resolved, note, created_at, updated_at) VALUES (?, 0, ?, NOW(), NOW())",
                tableId, note
        );
        return true;
    }
}


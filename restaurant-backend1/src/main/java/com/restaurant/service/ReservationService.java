package com.restaurant.service;

import com.restaurant.dto.request.CreateReservationRequest;
import com.restaurant.dto.request.UpdateReservationRequest;
import com.restaurant.dto.response.PageResponse;
import com.restaurant.dto.response.ReservationHistoryItemResponse;
import com.restaurant.mapper.ReservationHistoryItemMapper;
import java.security.Principal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReservationService {
    private static final Set<String> ALLOWED_STATUSES =
            Set.of("PENDING", "CONFIRMED", "ARRIVED", "COMPLETED", "CANCELLED");

    private final JdbcTemplate jdbcTemplate;
    private final ReservationHistoryItemMapper mapper;
    private final ZaloNotificationService zaloNotificationService;

    @Transactional
    public ReservationHistoryItemResponse createReservation(CreateReservationRequest req, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return null;
        jdbcTemplate.update(
                "INSERT INTO reservations(user_id, table_id, reservation_time, number_of_guests, customer_name, customer_phone, note, status, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())",
                userId,
                req.getTableId(),
                Timestamp.valueOf(req.getReservationTime()),
                req.getNumberOfGuests(),
                req.getCustomerName(),
                req.getCustomerPhone(),
                req.getNote()
        );
        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        if (id == null) return null;

        return ReservationHistoryItemResponse.builder()
                .id(id)
                .reservationTime(req.getReservationTime())
                .numberOfGuests(req.getNumberOfGuests())
                .customerName(req.getCustomerName())
                .customerPhone(req.getCustomerPhone())
                .status("PENDING")
                .tableNumber(null)
                .note(req.getNote())
                .build();
    }

    /**
     * Compatibility overload for legacy callers that still pass (userId, requestDTO).
     * Tries to map common ReservationRequest shape via reflection.
     */
    @Transactional
    public ReservationHistoryItemResponse createReservation(Long userId, Object legacyRequest) {
        if (userId == null || legacyRequest == null) return null;
        try {
            CreateReservationRequest mapped = new CreateReservationRequest();
            mapped.setReservationTime((LocalDateTime) legacyRequest.getClass().getMethod("getReservationTime").invoke(legacyRequest));
            mapped.setNumberOfGuests((Integer) legacyRequest.getClass().getMethod("getNumberOfGuests").invoke(legacyRequest));
            mapped.setCustomerName((String) legacyRequest.getClass().getMethod("getCustomerName").invoke(legacyRequest));
            mapped.setCustomerPhone((String) legacyRequest.getClass().getMethod("getCustomerPhone").invoke(legacyRequest));
            mapped.setTableId((Long) legacyRequest.getClass().getMethod("getTableId").invoke(legacyRequest));
            Object note = legacyRequest.getClass().getMethod("getNote").invoke(legacyRequest);
            mapped.setNote(note == null ? null : String.valueOf(note));

            Principal principal = () -> String.valueOf(userId);
            return createReservation(mapped, principal);
        } catch (Exception ex) {
            return null;
        }
    }

    public PageResponse<ReservationHistoryItemResponse> getMyReservations(Principal principal, int page, int size) {
        Long userId = extractUserId(principal);
        if (userId == null) return null;
        int safePage = Math.max(0, page);
        int safeSize = Math.min(200, Math.max(1, size));
        int offset = safePage * safeSize;

        var content = jdbcTemplate.query(
                "SELECT r.id, r.reservation_time, r.number_of_guests, r.customer_name, r.customer_phone, r.status, " +
                        "rt.table_number, r.note " +
                        "FROM reservations r " +
                        "LEFT JOIN restaurant_tables rt ON rt.id = r.table_id " +
                        "WHERE r.user_id = ? " +
                        "ORDER BY r.created_at DESC LIMIT ? OFFSET ?",
                (rs, i) -> mapper.fromResultSet(rs),
                userId, safeSize, offset
        );

        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reservations WHERE user_id = ?",
                Long.class,
                userId
        );

        return PageResponse.<ReservationHistoryItemResponse>builder()
                .content(content)
                .page(safePage)
                .size(safeSize)
                .totalElements(total == null ? content.size() : total)
                .build();
    }

    @Transactional
    public boolean cancelReservation(Long id, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return false;
        int updated = jdbcTemplate.update(
                "UPDATE reservations SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() " +
                        "WHERE id = ? AND user_id = ? AND status IN ('PENDING', 'CONFIRMED')",
                id, userId
        );
        return updated > 0;
    }

    @Transactional
    public boolean updateReservationByStaff(Long id, UpdateReservationRequest req) {
        String oldStatus = jdbcTemplate.query(
                "SELECT status FROM reservations WHERE id = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("status") : null,
                id
        );
        if (oldStatus == null) return false;

        String normalizedStatus = normalizeStatus(req.getStatus());
        if (req.getStatus() != null && normalizedStatus == null) {
            return false;
        }

        int updated = jdbcTemplate.update(
                "UPDATE reservations SET " +
                        "reservation_time = COALESCE(?, reservation_time), " +
                        "number_of_guests = COALESCE(?, number_of_guests), " +
                        "customer_name = COALESCE(?, customer_name), " +
                        "customer_phone = COALESCE(?, customer_phone), " +
                        "note = COALESCE(?, note), " +
                        "status = COALESCE(?, status), " +
                        "updated_at = NOW() " +
                        "WHERE id = ?",
                req.getReservationTime() == null ? null : Timestamp.valueOf(req.getReservationTime()),
                req.getNumberOfGuests(),
                req.getCustomerName(),
                req.getCustomerPhone(),
                req.getNote(),
                normalizedStatus,
                id
        );
        if (updated <= 0) return false;

        String newStatus = normalizedStatus;
        boolean confirmedNow = newStatus != null
                && "CONFIRMED".equalsIgnoreCase(newStatus)
                && (oldStatus == null || !"CONFIRMED".equalsIgnoreCase(oldStatus));

        if (confirmedNow) {
            var info = jdbcTemplate.query(
                    "SELECT customer_name, customer_phone, reservation_time, number_of_guests FROM reservations WHERE id = ? LIMIT 1",
                    rs -> rs.next()
                            ? new Object[]{
                                    rs.getString("customer_name"),
                                    rs.getString("customer_phone"),
                                    rs.getTimestamp("reservation_time"),
                                    rs.getInt("number_of_guests")
                            }
                            : null,
                    id
            );
            if (info != null) {
                Timestamp ts = (Timestamp) info[2];
                zaloNotificationService.sendReservationConfirmed(
                        (String) info[0],
                        (String) info[1],
                        ts == null ? null : ts.toLocalDateTime(),
                        (Integer) info[3]
                );
            }
        }
        return true;
    }

    public List<ReservationHistoryItemResponse> getTodayReservationsForStaff() {
        return getReservationsForDateForStaff(LocalDate.now());
    }

    public List<ReservationHistoryItemResponse> getReservationsForDateForStaff(LocalDate date) {
        LocalDate targetDate = date == null ? LocalDate.now() : date;
        return jdbcTemplate.query(
                "SELECT r.id, r.reservation_time, r.number_of_guests, r.customer_name, r.customer_phone, r.status, " +
                        "rt.table_number, r.note " +
                        "FROM reservations r " +
                        "LEFT JOIN restaurant_tables rt ON rt.id = r.table_id " +
                        "WHERE DATE(r.reservation_time) = ? " +
                        "ORDER BY r.reservation_time ASC, r.id DESC",
                (rs, i) -> mapper.fromResultSet(rs),
                targetDate
        );
    }

    @Transactional
    public boolean confirmReservationByStaff(Long id) {
        return transitionStatus(id, "PENDING", "CONFIRMED");
    }

    @Transactional
    public boolean markArrivedByStaff(Long id) {
        return transitionStatus(id, "CONFIRMED", "ARRIVED");
    }

    @Transactional
    public boolean completeReservationByStaff(Long id) {
        return transitionStatus(id, "ARRIVED", "COMPLETED");
    }

    @Transactional
    public void confirmReservationByStaffOrThrow(Long id) {
        if (!confirmReservationByStaff(id)) {
            throw new IllegalArgumentException("Chỉ có thể xác nhận đơn đang PENDING.");
        }
    }

    @Transactional
    public void markArrivedByStaffOrThrow(Long id) {
        if (!markArrivedByStaff(id)) {
            throw new IllegalArgumentException("Chỉ có thể chuyển ARRIVED từ đơn CONFIRMED.");
        }
    }

    @Transactional
    public void completeReservationByStaffOrThrow(Long id) {
        if (!completeReservationByStaff(id)) {
            throw new IllegalArgumentException("Chỉ có thể hoàn thành đơn ARRIVED.");
        }
    }

    private boolean transitionStatus(Long id, String expectedCurrent, String target) {
        int updated = jdbcTemplate.update(
                "UPDATE reservations SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?",
                target,
                id,
                expectedCurrent
        );
        if (updated <= 0) return false;

        if ("CONFIRMED".equals(target)) {
            sendZaloByReservationId(id);
        }
        return true;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return null;
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        return ALLOWED_STATUSES.contains(normalized) ? normalized : null;
    }

    private void sendZaloByReservationId(Long id) {
        var info = jdbcTemplate.query(
                "SELECT customer_name, customer_phone, reservation_time, number_of_guests FROM reservations WHERE id = ? LIMIT 1",
                rs -> rs.next()
                        ? new Object[]{
                                rs.getString("customer_name"),
                                rs.getString("customer_phone"),
                                rs.getTimestamp("reservation_time"),
                                rs.getInt("number_of_guests")
                        }
                        : null,
                id
        );
        if (info == null) return;

        Timestamp ts = (Timestamp) info[2];
        zaloNotificationService.sendReservationConfirmed(
                (String) info[0],
                (String) info[1],
                ts == null ? null : ts.toLocalDateTime(),
                (Integer) info[3]
        );
    }

    private Long extractUserId(Principal principal) {
        if (principal == null || principal.getName() == null) return null;
        try {
            return Long.parseLong(principal.getName());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

}

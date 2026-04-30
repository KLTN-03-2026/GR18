package com.restaurant.service;

import com.restaurant.dto.request.CreateReservationRequest;
import com.restaurant.dto.request.MarkArrivedRequest;
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
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReservationService {
    private static final Set<String> ALLOWED_STATUSES =
            Set.of("PENDING", "CONFIRMED", "ARRIVED", "COMPLETED", "CANCELLED");

    /** Tối đa bản ghi tạo trong 10 phút (chống spam / bấm liên tục) */
    private static final int MAX_RESERVATION_CREATES_PER_10_MIN = 5;
    /** Cho phép tối đa 5 đặt PENDING/CONFIRMED chưa đến giờ diễn ra */
    private static final int MAX_UPCOMING_PENDING_OR_CONFIRMED = 5;
    /** Trùng khung giờ: đã có đặt chờ/xác nhận trong ±30 phút */
    private static final int NEAR_DUPLICATE_WINDOW_SECONDS = 1800;

    private final JdbcTemplate jdbcTemplate;
    private final ReservationHistoryItemMapper mapper;
    private final ZaloNotificationService zaloNotificationService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public ReservationHistoryItemResponse createReservation(CreateReservationRequest req, Principal principal) {
        Long userId = extractUserId(principal);
        if (userId == null) return null;
        assertBookingNotSpam(userId, req.getReservationTime());
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

        messagingTemplate.convertAndSend(
                "/topic/staff/notifications",
                Map.of(
                        "type", "RESERVATION_NEW",
                        "reservationId", id,
                        "customerName", req.getCustomerName() != null ? req.getCustomerName() : "",
                        "reservationTime",
                                req.getReservationTime() != null ? req.getReservationTime().toString() : "",
                        "numberOfGuests", req.getNumberOfGuests() != null ? req.getNumberOfGuests() : 0));

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
                "SELECT r.id, r.table_id, r.reservation_time, r.number_of_guests, r.customer_name, r.customer_phone, r.status, " +
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
                        "table_id = COALESCE(?, table_id), " +
                        "status = COALESCE(?, status), " +
                        "updated_at = NOW() " +
                        "WHERE id = ?",
                req.getReservationTime() == null ? null : Timestamp.valueOf(req.getReservationTime()),
                req.getNumberOfGuests(),
                req.getCustomerName(),
                req.getCustomerPhone(),
                req.getNote(),
                req.getTableId(),
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
                "SELECT r.id, r.table_id, r.reservation_time, r.number_of_guests, r.customer_name, r.customer_phone, r.status, " +
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
        return markArrivedByStaff(id, null);
    }

    /**
     * CONFIRMED → ARRIVED; gán bàn cụ thể nếu gửi tableId (bắt buộc nếu chưa có table_id và khách đặt món bằng QR).
     */
    @Transactional
    public boolean markArrivedByStaff(Long id, Long tableId) {
        int updated = jdbcTemplate.update(
                "UPDATE reservations SET status = ?, " +
                        "table_id = COALESCE(?, table_id), " +
                        "arrived_at = NOW(), " +
                        "updated_at = NOW() WHERE id = ? AND status = ?",
                "ARRIVED",
                tableId,
                id,
                "CONFIRMED"
        );
        return updated > 0;
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
        markArrivedByStaffOrThrow(id, null);
    }

    @Transactional
    public void markArrivedByStaffOrThrow(Long id, MarkArrivedRequest body) {
        Long tableId = body != null ? body.getTableId() : null;
        if (!markArrivedByStaff(id, tableId)) {
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

    /**
     * Chống spam đặt bàn: bấm liên tục, nhiều đặt trùng khung giờ, quá nhiều đặt tương lai.
     */
    private void assertBookingNotSpam(Long userId, LocalDateTime reservationTime) {
        Timestamp ts = Timestamp.valueOf(reservationTime);

        Long recentCreates = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM reservations
                        WHERE user_id = ?
                          AND created_at >= (NOW() - INTERVAL 10 MINUTE)
                        """,
                Long.class,
                userId);
        if (recentCreates != null && recentCreates >= MAX_RESERVATION_CREATES_PER_10_MIN) {
            throw new IllegalArgumentException(
                    "Quá nhiều yêu cầu đặt bàn trong thời gian ngắn. Vui lòng thử lại sau ít nhất 10 phút.");
        }

        Long nearDuplicate = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM reservations
                        WHERE user_id = ?
                          AND status IN ('PENDING', 'CONFIRMED')
                          AND ABS(TIMESTAMPDIFF(SECOND, reservation_time, ?)) <= ?
                        """,
                Long.class,
                userId,
                ts,
                NEAR_DUPLICATE_WINDOW_SECONDS);
        if (nearDuplicate != null && nearDuplicate >= 1L) {
            throw new IllegalArgumentException(
                    "Bạn đã có đặt bàn trùng hoặc quá gần khung giờ này (đang chờ xử lý hoặc đã xác nhận). "
                            + "Hãy chỉnh giờ khác hoặc hủy đặt cũ trong mục Lịch sử.");
        }

        Long upcomingActive = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM reservations
                        WHERE user_id = ?
                          AND status IN ('PENDING', 'CONFIRMED')
                          AND reservation_time >= NOW()
                        """,
                Long.class,
                userId);
        if (upcomingActive != null && upcomingActive >= MAX_UPCOMING_PENDING_OR_CONFIRMED) {
            throw new IllegalArgumentException(
                    "Bạn đang có tối đa "
                            + MAX_UPCOMING_PENDING_OR_CONFIRMED
                            + " đặt chỗ chưa diễn ra. Hãy hủy hoặc đợi xử lý xong các đặt cũ trước khi đặt thêm.");
        }
    }

}

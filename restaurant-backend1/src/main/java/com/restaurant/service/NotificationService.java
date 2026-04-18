package com.restaurant.service;

import com.restaurant.entity.Notification;
import com.restaurant.entity.Reservation;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.NotificationType;
import com.restaurant.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public void sendReservationConfirmation(User user, Reservation reservation) {
        Notification notification = Notification.builder()
                .user(user)
                .type(NotificationType.RESERVATION)
                .title("Đặt bàn thành công")
                .message("Bàn số " + reservation.getTable().getTableNumber()
                        + " đã được xác nhận vào lúc " + reservation.getReservationTime())
                .referenceId(reservation.getId())
                .build();

        notificationRepository.save(notification);

        // GỬI REALTIME: Chỉ gửi những thông tin Frontend cần, tránh gửi cả object User
        sendRealtime(user.getId(), notification);
    }

    public void sendOrderStatusUpdate(Long userId, Long orderId, String statusMessage) {
        if (userId == null) return;
        User userRef = new User();
        userRef.setId(userId);

        Notification notification = Notification.builder()
                .user(userRef)
                .type(NotificationType.ORDER_STATUS)
                .title("Cập nhật đơn hàng")
                .message(statusMessage)
                .referenceId(orderId)
                .build();

        notificationRepository.save(notification);

        // GỬI REALTIME
        sendRealtime(userId, notification);
    }

    private void sendRealtime(Long userId, Notification notification) {
        try {
            Map<String, Object> payload = Map.of(
                    "id", notification.getId(),
                    "type", notification.getType().name(),
                    "title", notification.getTitle(),
                    "message", notification.getMessage(),
                    "referenceId", notification.getReferenceId() != null ? notification.getReferenceId() : "",
                    "isRead", false,
                    "createdAt", System.currentTimeMillis() // Hoặc notification.getCreatedAt()
            );

            messagingTemplate.convertAndSendToUser(
                    String.valueOf(userId), "/queue/notifications", payload);

            log.info("Đã gửi thông báo realtime tới User ID: {}", userId);
        } catch (Exception e) {
            log.error("Lỗi khi gửi thông báo qua WebSocket: {}", e.getMessage());
        }
    }

    public Page<Notification> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    public long countUnread(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsReadByUser(userId);
    }
}
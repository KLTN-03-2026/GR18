package com.restaurant.service;

import com.restaurant.entity.Reservation;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.ReservationStatus;
import com.restaurant.repository.MenuItemRepository;
import com.restaurant.repository.OrderItemRepository;
import com.restaurant.repository.OrderRepository;
import com.restaurant.repository.ReservationRepository;
import com.restaurant.repository.RestaurantTableRepository;
import com.restaurant.repository.UserRepository;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceReservationLinkingTest {

    @Mock
    OrderRepository orderRepository;

    @Mock
    OrderItemRepository orderItemRepository;

    @Mock
    MenuItemRepository menuItemRepository;

    @Mock
    RestaurantTableRepository tableRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    SimpMessagingTemplate messagingTemplate;

    @Mock
    NotificationService notificationService;

    @Mock
    ReservationRepository reservationRepository;

    @InjectMocks
    OrderService orderService;

    @Mock
    RestaurantTable table;

    private Method resolveReservationLinkingQrOrder;

    @BeforeEach
    void setUp() throws Exception {
        resolveReservationLinkingQrOrder =
                OrderService.class.getDeclaredMethod(
                        "resolveReservationLinkingQrOrder", RestaurantTable.class);
        resolveReservationLinkingQrOrder.setAccessible(true);
        when(table.getId()).thenReturn(10L);
    }

    private Reservation invokeLink() throws Exception {
        return (Reservation) resolveReservationLinkingQrOrder.invoke(orderService, table);
    }

    private Reservation reservation(
            ReservationStatus status, User user, LocalDateTime resTime, LocalDateTime updatedAt) {
        Reservation r =
                Reservation.builder()
                        .user(user)
                        .reservationTime(resTime)
                        .numberOfGuests(2)
                        .customerName("Khách")
                        .customerPhone("0900000001")
                        .status(status)
                        .build();
        r.setUpdatedAt(updatedAt);
        return r;
    }

    @Test
    void returnedArrivedWhenPresent_doesNotQueryConfirmed() throws Exception {
        User user = mock(User.class);
        LocalDateTime t = LocalDateTime.now().withNano(0);
        Reservation arrived = reservation(ReservationStatus.ARRIVED, user, t, t);
        when(reservationRepository.findFirstByTable_IdAndStatusOrderByUpdatedAtDesc(
                        10L, ReservationStatus.ARRIVED))
                .thenReturn(Optional.of(arrived));

        Reservation out = invokeLink();

        assertThat(out).isSameAs(arrived);
        verify(reservationRepository, never())
                .findByTableIdAndStatus(anyLong(), any(ReservationStatus.class));
    }

    @Test
    void fallsBackToMostRecentlyUpdatedConfirmedToday() throws Exception {
        when(reservationRepository.findFirstByTable_IdAndStatusOrderByUpdatedAtDesc(
                        10L, ReservationStatus.ARRIVED))
                .thenReturn(Optional.empty());

        User user = mock(User.class);
        LocalDateTime noonToday = LocalDateTime.now().withHour(12).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime u1 = noonToday.plusHours(-2);
        LocalDateTime u2 = noonToday.plusHours(-1);
        Reservation older = reservation(ReservationStatus.CONFIRMED, user, noonToday, u1);
        Reservation newer = reservation(ReservationStatus.CONFIRMED, user, noonToday, u2);
        when(reservationRepository.findByTableIdAndStatus(10L, ReservationStatus.CONFIRMED))
                .thenReturn(List.of(older, newer));

        Reservation out = invokeLink();

        assertThat(out).isSameAs(newer);
    }
}

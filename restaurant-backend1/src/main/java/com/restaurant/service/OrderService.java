package com.restaurant.service;

import com.restaurant.entity.Order;
import com.restaurant.entity.OrderItem;
import com.restaurant.entity.MenuItem;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.dto.response.order.GuestOrderResponse;
import com.restaurant.dto.response.order.StaffOrderDetailResponse;
import com.restaurant.entity.User;
import com.restaurant.dto.response.order.StaffOrderResponse;
import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.entity.enums.OrderItemStatus;
import com.restaurant.entity.enums.PaymentMethod;
import com.restaurant.entity.enums.PaymentStatus;
import com.restaurant.entity.enums.TableStatus;
import com.restaurant.dto.request.OrderRequest;
import com.restaurant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final MenuItemRepository menuItemRepository;
    private final RestaurantTableRepository tableRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;

    // Khách quét QR -> đặt món (không cần đăng nhập)
    public Order createOrder(OrderRequest request) {
        RestaurantTable table = tableRepository.findByQrCodeToken(request.getQrToken())
                .orElseThrow(() -> new IllegalArgumentException("Mã QR không hợp lệ hoặc đã hết hạn"));

        Order order = Order.builder()
                .table(table)
                .guestName(request.getGuestName())
                .status(OrderStatus.PENDING)
                .paymentStatus(PaymentStatus.UNPAID)
                .note(request.getNote())
                .build();

        if (request.getUserId() != null) {
            userRepository.findById(request.getUserId()).ifPresent(order::setUser);
        }

        // Tính toán items
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (OrderRequest.OrderItemRequest itemReq : request.getItems()) {
            MenuItem menuItem = menuItemRepository.findById(itemReq.getMenuItemId())
                    .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại: " + itemReq.getMenuItemId()));

            if (!menuItem.getIsAvailable()) {
                throw new IllegalArgumentException("Món '" + menuItem.getName() + "' hiện không có sẵn");
            }

            BigDecimal subtotal = menuItem.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .menuItem(menuItem)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(menuItem.getPrice())
                    .subtotal(subtotal)
                    .note(itemReq.getNote())
                    .status(OrderItemStatus.PENDING)
                    .build();
            order.getOrderItems().add(orderItem);
            totalAmount = totalAmount.add(subtotal);
        }

        order.setTotalAmount(totalAmount);
        Order savedOrder = orderRepository.save(order);

        table.setStatus(TableStatus.OCCUPIED);
        tableRepository.save(table);

        // Gửi realtime notification cho nhân viên (JSON object để STOMP/Jackson ổn định)
        messagingTemplate.convertAndSend(
                "/topic/orders/new",
                Map.of(
                        "type", "ORDER_NEW",
                        "orderId", savedOrder.getId(),
                        "tableNumber", table.getTableNumber() != null ? table.getTableNumber() : ""));

        return savedOrder;
    }

    // Nhân viên/Bếp cập nhật trạng thái đơn hàng
    public Order updateOrderStatus(Long orderId, OrderStatus status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        order.setStatus(status);
        Order updated = orderRepository.save(order);

        // Gửi realtime cho khách hàng
        messagingTemplate.convertAndSend("/topic/orders/" + orderId + "/status", status);

        return updated;
    }

    // Xử lý thanh toán
    public Order processPayment(Long orderId, PaymentMethod method) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));

        if (order.getPaymentStatus() == PaymentStatus.PAID) {
            throw new IllegalStateException("Đơn hàng đã được thanh toán");
        }

        order.setPaymentStatus(PaymentStatus.PAID);
        order.setPaymentMethod(method);
        order.setPaidAt(LocalDateTime.now());
        order.setStatus(OrderStatus.COMPLETED);

        // Cập nhật totalSold cho từng món
        order.getOrderItems().forEach(item -> {
            MenuItem mi = item.getMenuItem();
            mi.setTotalSold(mi.getTotalSold() + item.getQuantity());
            menuItemRepository.save(mi);
        });

        // Giải phóng bàn (DB + thông báo realtime)
        RestaurantTable table = order.getTable();
        if (table != null) {
            table.setStatus(TableStatus.AVAILABLE);
            tableRepository.save(table);
            messagingTemplate.convertAndSend("/topic/tables/" + table.getId() + "/status", "AVAILABLE");
            messagingTemplate.convertAndSend(
                    "/topic/staff/tables/status",
                    Map.of("tableId", table.getId(), "status", TableStatus.AVAILABLE.name()));
        }

        return orderRepository.save(order);
    }

    /** Trả DTO thay vì entity {@link Order} để tránh lỗi lazy {@code table} khi ghi JSON (open-in-view=false). */
    public StaffOrderResponse updateOrderStatusAndSummarize(Long orderId, OrderStatus status) {
        updateOrderStatus(orderId, status);
        Order order = orderRepository.findDetailById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        return toStaffOrderResponse(order);
    }

    public StaffOrderResponse processPaymentAndSummarize(Long orderId, PaymentMethod method) {
        processPayment(orderId, method);
        Order order = orderRepository.findDetailById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        return toStaffOrderResponse(order);
    }

    public List<Order> getActiveOrdersByTable(Long tableId) {
        return orderRepository.findActiveOrdersByTable(tableId);
    }

    public List<Order> getAllActiveOrders() {
        return orderRepository.findByStatusIn(
                List.of(OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.SERVING));
    }

    public List<StaffOrderResponse> getAllActiveOrderSummaries() {
        return getAllActiveOrders().stream().map(this::toStaffOrderResponse).toList();
    }

    public List<StaffOrderResponse> getActiveOrderSummariesByTable(Long tableId) {
        return getActiveOrdersByTable(tableId).stream().map(this::toStaffOrderResponse).toList();
    }

    @Transactional(readOnly = true)
    public StaffOrderDetailResponse getStaffOrderDetail(Long orderId) {
        Order order = orderRepository.findDetailById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        return buildStaffOrderDetailResponse(order);
    }

    @Transactional(readOnly = true)
    public StaffOrderDetailResponse getCustomerOrderDetail(Long orderId, Long userId) {
        Order order = orderRepository.findDetailById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        User owner = order.getUser();
        if (owner == null || !owner.getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem đơn này");
        }
        return buildStaffOrderDetailResponse(order);
    }

    private StaffOrderDetailResponse buildStaffOrderDetailResponse(Order order) {
        List<StaffOrderDetailResponse.LineItem> lines = new ArrayList<>();
        if (order.getOrderItems() != null) {
            for (OrderItem oi : order.getOrderItems()) {
                String name = oi.getMenuItem() != null ? oi.getMenuItem().getName() : "Món";
                lines.add(StaffOrderDetailResponse.LineItem.builder()
                        .itemName(name)
                        .quantity(oi.getQuantity())
                        .unitPrice(oi.getUnitPrice())
                        .subtotal(oi.getSubtotal())
                        .note(oi.getNote())
                        .build());
            }
        }
        return StaffOrderDetailResponse.builder()
                .id(order.getId())
                .tableId(order.getTable() != null ? order.getTable().getId() : null)
                .tableNumber(order.getTable() != null ? order.getTable().getTableNumber() : null)
                .guestName(order.getGuestName())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .paidAt(order.getPaidAt())
                .createdAt(order.getCreatedAt())
                .note(order.getNote())
                .items(lines)
                .build();
    }

    @Transactional(readOnly = true)
    public List<StaffOrderResponse> getRecentPaidOrderSummaries(int limit) {
        int capped = Math.min(Math.max(limit, 1), 100);
        Page<Order> page = orderRepository.findByStatusAndPaymentStatus(
                OrderStatus.COMPLETED,
                PaymentStatus.PAID,
                PageRequest.of(0, capped, Sort.by("paidAt").descending()));
        return page.getContent().stream().map(this::toStaffOrderResponse).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTodayRevenueForStaff() {
        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime now = LocalDateTime.now();
        BigDecimal todayRevenue = orderRepository.sumRevenueByDateRange(startOfDay, now);
        return Map.of("todayRevenue", todayRevenue);
    }

    // A1: Lấy đơn hàng hiện tại theo QR token của bàn (US04)
    public List<Order> getActiveOrdersByQrToken(String qrToken) {
        RestaurantTable table = tableRepository.findByQrCodeToken(qrToken)
                .orElseThrow(() -> new IllegalArgumentException("Mã QR không hợp lệ"));
        return orderRepository.findActiveOrdersByTable(table.getId());
    }

    public GuestOrderResponse createGuestOrderResponse(OrderRequest request) {
        Order order = createOrder(request);
        return toGuestOrderResponse(order);
    }

    public List<GuestOrderResponse> getActiveOrderSummariesByQrToken(String qrToken) {
        List<Order> orders = getActiveOrdersByQrToken(qrToken);
        List<GuestOrderResponse> result = new ArrayList<>();
        for (Order order : orders) {
            result.add(toGuestOrderResponse(order));
        }
        return result;
    }

    // A1: Lịch sử đơn hàng của user (US08) — map DTO trong transaction (open-in-view=false)
    @Transactional(readOnly = true)
    public Page<GuestOrderResponse> getUserOrderResponses(Long userId, Pageable pageable) {
        return orderRepository.findByUserId(userId, pageable).map(this::toGuestOrderResponse);
    }

    // C7: Lấy userId từ JWT Authentication object
    public Long getUserIdFromAuth(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Chưa đăng nhập");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud) {
            return Long.parseLong(ud.getUsername()); // CustomUserDetails trả về userId làm username
        }
        throw new IllegalStateException("Không xác định được người dùng");
    }

    private GuestOrderResponse toGuestOrderResponse(Order order) {
        return GuestOrderResponse.builder()
                .id(order.getId())
                .tableId(order.getTable() != null ? order.getTable().getId() : null)
                .tableNumber(order.getTable() != null ? order.getTable().getTableNumber() : null)
                .guestName(order.getGuestName())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .paidAt(order.getPaidAt())
                .totalAmount(order.getTotalAmount())
                .note(order.getNote())
                .createdAt(order.getCreatedAt())
                .build();
    }

    private StaffOrderResponse toStaffOrderResponse(Order order) {
        String mainItem = "Chưa có món";
        int itemCount = 0;

        if (order.getOrderItems() != null && !order.getOrderItems().isEmpty()) {
            itemCount = order.getOrderItems().size();
            mainItem = order.getOrderItems().get(0).getMenuItem() != null
                    ? order.getOrderItems().get(0).getMenuItem().getName()
                    : "Món ăn";
        }

        return StaffOrderResponse.builder()
                .id(order.getId())
                .tableId(order.getTable() != null ? order.getTable().getId() : null)
                .tableNumber(order.getTable() != null ? order.getTable().getTableNumber() : null)
                .guestName(order.getGuestName())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .paidAt(order.getPaidAt())
                .createdAt(order.getCreatedAt())
                .note(order.getNote())
                .mainItem(mainItem)
                .itemCount(itemCount)
                .build();
    }
}

package com.restaurant.service;

import com.restaurant.entity.CallStaff;
import com.restaurant.entity.OrderItem;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.OrderItemStatus;
import com.restaurant.repository.CallStaffRepository;
import com.restaurant.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StaffOperationsService {

    private final OrderItemRepository orderItemRepository;
    private final CallStaffRepository callStaffRepository;
    private final TableService tableService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public OrderItem updateOrderItemStatus(Long itemId, OrderItemStatus status) {
        OrderItem item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy món"));
        item.setStatus(status);
        OrderItem saved = orderItemRepository.save(item);
        messagingTemplate.convertAndSend(
                "/topic/orders/" + saved.getOrder().getId() + "/items", saved.getId());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<CallStaff> getPendingCallStaffRequests() {
        return callStaffRepository.findByIsResolvedFalseOrderByCreatedAtAsc();
    }

    @Transactional
    public CallStaff resolveCallStaffRequest(Long id) {
        CallStaff call = callStaffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy yêu cầu"));
        call.setIsResolved(true);
        call.setResolvedAt(LocalDateTime.now());
        return callStaffRepository.save(call);
    }

    @Transactional
    public CallStaff createGuestCallStaffRequest(String qrToken, String note) {
        RestaurantTable table = tableService.getTableByQrToken(qrToken);

        boolean alreadyCalling = callStaffRepository
                .findByTableIdAndIsResolvedFalseOrderByCreatedAtDesc(table.getId())
                .stream()
                .findFirst()
                .isPresent();
        if (alreadyCalling) {
            throw new IllegalStateException("Bàn này đã có yêu cầu gọi nhân viên đang chờ xử lý");
        }

        CallStaff callStaff = CallStaff.builder()
                .table(table)
                .note(note)
                .isResolved(false)
                .build();
        CallStaff saved = callStaffRepository.save(callStaff);

        messagingTemplate.convertAndSend(
                "/topic/staff/call",
                Map.of(
                        "tableId", table.getId(),
                        "tableNumber", table.getTableNumber(),
                        "callId", saved.getId(),
                        "note", note != null ? note : ""
                ));
        return saved;
    }
}

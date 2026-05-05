package com.restaurant.service;

import com.restaurant.dto.response.CallStaffResponse;
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
    public List<CallStaffResponse> getPendingCallStaffResponses() {
        return callStaffRepository.findPendingWithTableFetched().stream()
                .map(this::toCallStaffResponse)
                .toList();
    }

    public CallStaffResponse toCallStaffResponse(CallStaff c) {
        if (c == null) {
            return null;
        }
        return CallStaffResponse.builder()
                .id(c.getId())
                .tableId(c.getTable() != null ? c.getTable().getId() : null)
                .tableNumber(c.getTable() != null ? c.getTable().getTableNumber() : null)
                .isResolved(c.getIsResolved())
                .createdAt(c.getCreatedAt())
                .resolvedAt(c.getResolvedAt())
                .note(c.getNote())
                .build();
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
    public CallStaffResponse resolveCallStaffRequestReturningDto(Long id) {
        CallStaff call = resolveCallStaffRequest(id);
        return toCallStaffResponse(call);
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

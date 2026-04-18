package com.restaurant.service;

import com.restaurant.chat.BookingContext;
import com.restaurant.chat.BookingSessionManager;
import com.restaurant.dto.request.CreateReservationRequest;
import com.restaurant.dto.response.ChatResponse;
import com.restaurant.dto.response.menu_items.MenuItemResponse;
import com.restaurant.entity.ChatbotMessage;
import com.restaurant.entity.MenuItem;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.ChatMessageSender;
import com.restaurant.mapper.MenuItemMapper;
import com.restaurant.repository.ChatbotMessageRepository;
import com.restaurant.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ReservationService reservationService;
    private final MenuItemRepository menuItemRepository;
    private final MenuItemMapper menuItemMapper;
    private final ChatbotMessageRepository chatbotMessageRepository;

    public ChatResponse handleMessage(String userMessage, String sessionId, User user) {
        String safeSessionId = (sessionId == null || sessionId.isBlank())
                ? UUID.randomUUID().toString()
                : sessionId.trim();
        String rawMessage = userMessage == null ? "" : userMessage.trim();
        String msg = rawMessage.toLowerCase();

        persistMessage(safeSessionId, user, ChatMessageSender.USER, rawMessage);
        BookingContext context = BookingSessionManager.get(safeSessionId);

        ChatResponse response;

        // ================== 🍽️ GỢI Ý MÓN ==================

        if (msg.contains("bán chạy")) {
            response = buildResponse("Món bán chạy:",
                    menuItemRepository.findTopSellingItems(PageRequest.of(0, 5)));
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        if (msg.contains("đánh giá cao") || msg.contains("rating")) {
            response = buildResponse("Món được đánh giá cao:",
                    menuItemRepository.findTopRatedItems(PageRequest.of(0, 5)));
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        if (msg.contains("rẻ") || msg.contains("sinh viên")) {
            response = buildResponse("Món giá rẻ:",
                    menuItemRepository.findByPriceLessThan(100000));
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        if (msg.contains("món") || msg.contains("ăn gì") || msg.contains("gợi ý") || msg.contains("ngon")) {
            response = suggestPopularDishes();
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        // ================== 🪑 ĐẶT BÀN ==================

        if (msg.contains("đặt bàn")) {
            BookingSessionManager.clear(safeSessionId);
            context = BookingSessionManager.get(safeSessionId);

            extractBookingInfo(msg, context);

            if (context.isComplete()) {
                context.setConfirmed(true);
                response = confirmMessage(context);
                persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                return response;
            }

            response = reply("Anh/chị muốn đặt ngày nào ạ?");
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        extractBookingInfo(msg, context);

        if (context.getDate() != null || context.getTime() != null || context.getGuests() != null) {

            if (!context.isComplete()) {

                if (context.getDate() == null)
                    response = reply("Anh/chị muốn đặt ngày nào ạ?");
                else if (context.getTime() == null)
                    response = reply("Anh/chị muốn đặt lúc mấy giờ ạ?");
                else
                    response = reply("Anh/chị đi bao nhiêu người ạ?");

                persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                return response;
            }

            if (!context.isConfirmed()) {
                context.setConfirmed(true);
                response = confirmMessage(context);
                persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                return response;
            }

            if (user == null) {
                response = reply("Vui lòng đăng nhập để đặt bàn ạ!");
                persistMessage(safeSessionId, null, ChatMessageSender.BOT, response.getReply());
                return response;
            }

            if ((msg.contains("ok") || msg.contains("đúng")) && context.isConfirmed()) {

                try {
                    LocalDateTime dateTime = LocalDateTime.parse(
                            context.getDate() + "T" + context.getTime() + ":00"
                    );

                    if (dateTime.isBefore(LocalDateTime.now())) {
                        response = reply("Không thể đặt bàn trong quá khứ!");
                        persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                        return response;
                    }

                    if (context.getGuests() > 10) {
                        response = reply("Tối đa 10 khách thôi ạ!");
                        persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                        return response;
                    }

                    CreateReservationRequest request = new CreateReservationRequest();
                    request.setReservationTime(dateTime);
                    request.setNumberOfGuests(context.getGuests());
                    request.setCustomerName(user.getFullName());
                    request.setCustomerPhone(user.getPhone());
                    request.setTableId(null);
                    request.setNote("Đặt qua chatbot");

                    reservationService.createReservation(request, () -> String.valueOf(user.getId()));
                    BookingSessionManager.clear(safeSessionId);
                    response = reply("Đặt bàn thành công!");
                    persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                    return response;
                } catch (Exception e) {
                    log.error("Booking error", e);
                    response = reply("Có lỗi xảy ra, thử lại nhé!");
                    persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
                    return response;
                }
            }

            response = reply("Anh/chị xác nhận (OK) để em đặt bàn nhé!");
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        // ================== 🤖 FALLBACK ==================
        response = reply("Em có thể gợi ý món hoặc đặt bàn cho anh/chị ạ");
        persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
        return response;
    }

    private void persistMessage(String sessionId, User user, ChatMessageSender sender, String message) {
        try {
            ChatbotMessage entity = ChatbotMessage.builder()
                    .sessionId(sessionId)
                    .user(user)
                    .sender(sender)
                    .message(message == null ? "" : message)
                    .build();
            chatbotMessageRepository.save(entity);
        } catch (Exception ex) {
            log.warn("Could not persist chatbot message: {}", ex.getMessage());
        }
    }

    // ================== 🍽️ GỢI Ý MÓN ==================

    private ChatResponse suggestPopularDishes() {

        List<MenuItem> items = menuItemRepository.findTopRecommended();

        if (items.isEmpty()) {
            return reply("Hiện chưa có món nổi bật");
        }

        List<MenuItemResponse> data = menuItemMapper.toResponseList(items);

        return ChatResponse.builder()
                .reply("Một vài món bạn có thể thích:")
                .status("success")
                .data(data)
                .build();
    }

    private ChatResponse buildResponse(String title, List<MenuItem> items) {

        List<MenuItemResponse> data = menuItemMapper.toResponseList(items);

        return ChatResponse.builder()
                .reply(title)
                .status("success")
                .data(data)
                .build();
    }

    // ================== HELPER ==================

    private ChatResponse confirmMessage(BookingContext context) {

        String displayDate = java.time.LocalDate.parse(context.getDate())
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

        return reply(String.format(
                "Xác nhận đặt bàn lúc %s ngày %s cho %d người?",
                context.getTime(),
                displayDate,
                context.getGuests()
        ));
    }

    private void extractBookingInfo(String msg, BookingContext context) {

        Pattern p = Pattern.compile("(\\d+)\\s*người");
        Matcher m = p.matcher(msg);
        if (m.find()) {
            context.setGuests(Integer.parseInt(m.group(1)));
        }

        Pattern timePattern = Pattern.compile("(\\d{1,2}:\\d{2})");
        Matcher timeMatcher = timePattern.matcher(msg);
        if (timeMatcher.find()) {
            context.setTime(timeMatcher.group(1));
        }

        if (msg.contains("hôm nay")) {
            context.setDate(java.time.LocalDate.now().toString());
        } else if (msg.contains("mai")) {
            context.setDate(java.time.LocalDate.now().plusDays(1).toString());
        }
    }

    private ChatResponse reply(String msg) {
        return ChatResponse.builder()
                .reply(msg)
                .status("success")
                .data(null)
                .build();
    }
}
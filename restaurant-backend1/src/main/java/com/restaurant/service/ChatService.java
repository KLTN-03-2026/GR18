package com.restaurant.service;

import com.restaurant.chat.BookingContext;
import com.restaurant.chat.BookingSessionManager;
import com.restaurant.dto.request.CreateReservationRequest;
import com.restaurant.dto.response.ChatResponse;
import com.restaurant.entity.ChatbotMessage;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.ChatMessageSender;
import com.restaurant.repository.ChatbotMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ReservationService reservationService;
    private final ChatbotMessageRepository chatbotMessageRepository;
    private final ChatMenuAssistant chatMenuAssistant;

    public ChatResponse handleMessage(String userMessage, String sessionId, User user) {
        String safeSessionId = (sessionId == null || sessionId.isBlank())
                ? UUID.randomUUID().toString()
                : sessionId.trim();
        String rawMessage = userMessage == null ? "" : userMessage.trim();
        String msg = rawMessage.toLowerCase(Locale.ROOT);

        persistMessage(safeSessionId, user, ChatMessageSender.USER, rawMessage);
        BookingContext context = BookingSessionManager.get(safeSessionId);

        ChatResponse response;

        if (!msg.contains("đặt bàn") && ChatMenuAssistant.isStandaloneGreeting(msg)) {
            response = reply(
                    "Chào anh/chị! Em là trợ lý Nhóm 18 — có thể gợi ý món, trả lời về Menu (giá, loại món…) "
                            + "và đặt bàn. Anh/chị muốn bắt đầu từ đâu ạ?");
            persistMessage(safeSessionId, user, ChatMessageSender.BOT, response.getReply());
            return response;
        }

        if (!msg.contains("đặt bàn")) {
            Optional<ChatResponse> nl = chatMenuAssistant.tryAnswerMenuQuestion(safeSessionId, user,
                    rawMessage, msg);
            if (nl.isPresent()) {
                BookingSessionManager.clear(safeSessionId);
                return nl.get();
            }
        }

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

        if (msg.matches("(?s).*\\b(món|menu|ăn gì|gợi ý|ngon|đói|thực đơn)\\b.*")) {
            return chatMenuAssistant.suggestPopularDishes(safeSessionId, user, rawMessage, null, null);
        }

        response = reply(
                "Em có thể gợi ý món, trả lời về thực đơn (nhóm giá/khẩu vị/dị ứng…) hoặc đặt bàn cho anh/chị ạ.");
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
                .suggestionLogId(null)
                .build();
    }
}
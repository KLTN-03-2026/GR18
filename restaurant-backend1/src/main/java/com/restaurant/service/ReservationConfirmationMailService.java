package com.restaurant.service;

import com.restaurant.config.EmailThymeleafConfig;
import com.restaurant.dto.response.ReservationHistoryItemResponse;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

/**
 * Gửi email HTML xác nhận đặt bàn (template Thymeleaf). SMTP khi có {@code spring.mail.username}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReservationConfirmationMailService {

    private final JavaMailSender mailSender;

    @Qualifier(EmailThymeleafConfig.EMAIL_TEMPLATE_ENGINE)
    private final SpringTemplateEngine emailTemplateEngine;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    public boolean isMailConfigured() {
        return StringUtils.hasText(mailFrom);
    }

    public void sendBookingReceivedEmail(String toEmail, ReservationHistoryItemResponse detail) {
        if (!StringUtils.hasText(toEmail) || detail == null) {
            log.debug("Bỏ qua email đặt bàn: thiếu email hoặc chi tiết đặt.");
            return;
        }
        if (!isMailConfigured()) {
            log.debug("Bỏ qua email đặt bàn: chưa cấu hình MAIL_USERNAME / spring.mail.username.");
            return;
        }
        try {
            String to = toEmail.trim();
            log.info("START SEND MAIL");
            log.info("MAIL TO = {}", to);
            log.info("MAIL USERNAME = {}", mailFrom);

            String htmlBody = renderHtml(detail);
            String plainBody = renderPlainFallback(detail);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(to);
            helper.setSubject("[Restaurant AI] Xác nhận yêu cầu đặt bàn #" + detail.getId());
            helper.setText(plainBody, htmlBody);

            mailSender.send(message);
            log.info("Đã gửi email xác nhận đặt bàn #{} tới {}", detail.getId(), maskEmail(to));
        } catch (MessagingException ex) {
            log.warn("Không gửi được email xác nhận đặt bàn #{}: {}", detail.getId(), ex.getMessage(), ex);
        } catch (Exception ex) {
            log.warn("Không gửi được email xác nhận đặt bàn #{}: {}", detail.getId(), ex.getMessage(), ex);
        }
    }

    private String renderHtml(ReservationHistoryItemResponse d) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        Context ctx = new Context(Locale.forLanguageTag("vi"));
        ctx.setVariable("customerName", d.getCustomerName() != null ? d.getCustomerName() : "Quý khách");
        ctx.setVariable("reservationId", d.getId());
        ctx.setVariable("reservationTimeFormatted", d.getReservationTime() != null ? d.getReservationTime().format(fmt) : "—");
        ctx.setVariable("numberOfGuests", d.getNumberOfGuests() != null ? d.getNumberOfGuests() : "—");

        boolean hasTable =
                d.getTableNumber() != null && !d.getTableNumber().isBlank();
        String tableDesc;
        if (hasTable) {
            tableDesc =
                    "Bàn " + d.getTableNumber()
                            + ((d.getTableLocation() != null && !d.getTableLocation().isBlank())
                                    ? " — " + d.getTableLocation()
                                    : "");
        } else {
            tableDesc = "Nhà hàng sẽ sắp xếp phù hợp sau khi xác nhận.";
        }
        ctx.setVariable("tableDescription", tableDesc);
        ctx.setVariable("customerPhone", d.getCustomerPhone() != null ? d.getCustomerPhone() : "—");
        ctx.setVariable("statusVi", statusVi(d.getStatus()));

        boolean hasNote = d.getNote() != null && !d.getNote().isBlank();
        ctx.setVariable("hasNote", hasNote);
        ctx.setVariable("note", hasNote ? d.getNote() : "");

        return emailTemplateEngine.process("reservation-confirmation", ctx);
    }

    /** Bản plaintext dự phòng (multipart/alternative). */
    private static String renderPlainFallback(ReservationHistoryItemResponse d) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        String time = d.getReservationTime() != null ? d.getReservationTime().format(fmt) : "—";
        StringBuilder sb = new StringBuilder();
        sb.append("Xin chào ").append(d.getCustomerName() != null ? d.getCustomerName() : "Quý khách").append(",\n\n");
        sb.append("Mã đặt bàn: #").append(d.getId()).append("\n");
        sb.append("Thời gian: ").append(time).append("\n");
        sb.append("Số khách: ").append(d.getNumberOfGuests() != null ? d.getNumberOfGuests() : "—").append("\n");
        if (d.getTableNumber() != null && !d.getTableNumber().isBlank()) {
            sb.append("Bàn: ").append(d.getTableNumber());
            if (d.getTableLocation() != null && !d.getTableLocation().isBlank()) {
                sb.append(" — ").append(d.getTableLocation());
            }
            sb.append("\n");
        } else {
            sb.append("Bàn: Nhà hàng sẽ sắp xếp phù hợp sau khi xác nhận.\n");
        }
        sb.append("Điện thoại: ").append(d.getCustomerPhone() != null ? d.getCustomerPhone() : "—").append("\n");
        sb.append("Trạng thái: ").append(statusVi(d.getStatus())).append("\n");
        if (d.getNote() != null && !d.getNote().isBlank()) {
            sb.append("\nGhi chú:\n").append(d.getNote()).append("\n");
        }
        sb.append("\n— Restaurant AI");
        return sb.toString();
    }

    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }

    private static String statusVi(String status) {
        if (status == null) return "—";
        return switch (status.toUpperCase()) {
            case "PENDING" -> "Chờ xác nhận";
            case "CONFIRMED" -> "Đã xác nhận";
            case "ARRIVED" -> "Đã đến";
            case "COMPLETED" -> "Hoàn thành";
            case "CANCELLED" -> "Đã hủy";
            default -> status;
        };
    }
}

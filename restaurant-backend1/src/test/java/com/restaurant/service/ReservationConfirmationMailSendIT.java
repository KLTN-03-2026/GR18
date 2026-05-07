package com.restaurant.service;

import com.restaurant.support.DotenvContextInitializer;
import com.restaurant.dto.response.ReservationHistoryItemResponse;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ContextConfiguration;

/**
 * Gửi một email HTML (Thymeleaf) thật qua SMTP.
 *
 * <p>Chạy: {@code ./gradlew test --tests ReservationConfirmationMailSendIT}
 *
 * <p>Cần MySQL như app thường (Flyway). Cần {@code MAIL_USERNAME} + {@code MAIL_PASSWORD}
 * (Gmail App Password) trong môi trường hoặc file {@code .env} tại thư mục project. Người nhận: {@code MAIL_TEST_TO} hoặc mặc định {@code MAIL_USERNAME}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ContextConfiguration(initializers = DotenvContextInitializer.class)
@Tag("mail")
class ReservationConfirmationMailSendIT {

    @Autowired
    ReservationConfirmationMailService reservationConfirmationMailService;

    @Autowired
    Environment environment;

    @Test
    void sendsReservationConfirmationTemplate() {
        Assumptions.assumeTrue(
                reservationConfirmationMailService.isMailConfigured(),
                "Đặt MAIL_USERNAME và MAIL_PASSWORD (Gmail App Password) rồi chạy lại test.");

        String to =
                firstNonBlank(
                        environment.getProperty("MAIL_TEST_TO"),
                        environment.getProperty("mail.test.to"));
        if (to == null) {
            to = environment.getProperty("MAIL_USERNAME");
        }
        Assumptions.assumeTrue(
                to != null && !to.isBlank(),
                "Không có người nhận: đặt MAIL_TEST_TO hoặc MAIL_USERNAME.");

        ReservationHistoryItemResponse detail =
                ReservationHistoryItemResponse.builder()
                        .id(1L)
                        .tableId(5L)
                        .reservationTime(
                                LocalDateTime.now()
                                        .plusDays(1)
                                        .withHour(19)
                                        .withMinute(30)
                                        .withSecond(0)
                                        .withNano(0))
                        .numberOfGuests(4)
                        .customerName("Khách thử nghiệm")
                        .customerPhone("0912345678")
                        .status("PENDING")
                        .tableNumber("A12")
                        .tableLocation("Tầng 1 — Cửa sổ")
                        .note("Email thử nghiệm template Thymeleaf (ReservationConfirmationMailSendIT)")
                        .build();

        reservationConfirmationMailService.sendBookingReceivedEmail(to.trim(), detail);
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return null;
    }
}

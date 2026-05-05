package com.restaurant.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@Slf4j
public class ZaloNotificationService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.zalo.enabled:false}")
    private boolean enabled;

    @Value("${app.zalo.webhook-url:}")
    private String webhookUrl;

    public void sendReservationConfirmed(String customerName, String customerPhone, LocalDateTime reservationTime, Integer guests) {
        if (!enabled || webhookUrl == null || webhookUrl.isBlank()) {
            return;
        }

        String timeDisplay = reservationTime == null
                ? "khong ro thoi gian"
                : reservationTime.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
        String guestDisplay = guests == null ? "?" : String.valueOf(guests);
        String phoneDisplay = customerPhone == null || customerPhone.isBlank() ? "N/A" : customerPhone;
        String nameDisplay = customerName == null || customerName.isBlank() ? "Khach hang" : customerName;

        String message = String.format(
                "[Restaurant AI] Dat ban da duoc xac nhan.%nKhach: %s%nSDT: %s%nThoi gian: %s%nSo khach: %s",
                nameDisplay,
                phoneDisplay,
                timeDisplay,
                guestDisplay
        );

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Webhook nhan payload don gian; tuy he thong Zalo trung gian co the doi ten field.
            Map<String, Object> payload = Map.of(
                    "text", message,
                    "customerName", nameDisplay,
                    "customerPhone", phoneDisplay,
                    "reservationTime", timeDisplay,
                    "guests", guestDisplay
            );

            restTemplate.postForEntity(webhookUrl, new HttpEntity<>(payload, headers), String.class);
        } catch (Exception ex) {
            log.warn("Could not send Zalo notification: {}", ex.getMessage());
        }
    }
}

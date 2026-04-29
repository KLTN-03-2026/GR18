package com.restaurant.bootstrap;

import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.TableStatus;
import com.restaurant.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khi Flyway tắt, file V1.0.7 có thể chưa chạy — thiếu token {@code demo-qr-b02} trong DB
 * thì link {@code menu.html?t=demo-qr-b02} trả 400. Tự bổ sung bàn demo nếu thiếu token.
 */
@Component
@Order(100)
@RequiredArgsConstructor
@Slf4j
public class DemoQrTablesSeeder implements ApplicationRunner {

    private final RestaurantTableRepository tableRepository;

    private record Demo(String tableNumber, int capacity, String location, String token) {}

    private static final Demo[] ROWS = {
            new Demo("B01", 4, "Sảnh chính", "demo-qr-b01"),
            new Demo("B02", 2, "Cửa sổ", "demo-qr-b02"),
            new Demo("B03", 6, "Khu gia đình", "demo-qr-b03"),
            new Demo("B04", 4, "Ngoài trời", "demo-qr-b04"),
            new Demo("B05", 4, "Tầng 2", "demo-qr-b05"),
            new Demo("B06", 2, "Quầy bar", "demo-qr-b06"),
    };

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (Demo d : ROWS) {
            if (tableRepository.findByQrCodeToken(d.token).isPresent()) {
                continue;
            }
            if (tableRepository.findByTableNumber(d.tableNumber).isPresent()) {
                log.debug("Seed bỏ qua {}: số bàn đã dùng (token khác)", d.tableNumber);
                continue;
            }
            tableRepository.save(RestaurantTable.builder()
                    .tableNumber(d.tableNumber)
                    .capacity(d.capacity)
                    .location(d.location)
                    .status(TableStatus.AVAILABLE)
                    .qrCodeToken(d.token)
                    .isActive(true)
                    .build());
            log.info("Demo QR: đã tạo bàn {} token {}", d.tableNumber, d.token);
        }
        // B02 đã tồn tại với token UUID (tạo từ admin) → không thể trùng số bàn; thêm dòng riêng cho demo-qr-b02
        if (tableRepository.findByQrCodeToken("demo-qr-b02").isEmpty()) {
            String tn = "DEMO_B02";
            if (tableRepository.findByTableNumber(tn).isPresent()) {
                log.warn("Không seed demo-qr-b02: đã có {} — cập nhật qr_code_token trong DB hoặc in QR mới từ Sơ đồ bàn.", tn);
                return;
            }
            tableRepository.save(RestaurantTable.builder()
                    .tableNumber(tn)
                    .capacity(2)
                    .location("Cửa sổ (demo)")
                    .status(TableStatus.AVAILABLE)
                    .qrCodeToken("demo-qr-b02")
                    .isActive(true)
                    .build());
            log.info("Demo QR: đã tạo bàn {} cho token demo-qr-b02 (B02 gốc đã tồn tại)", tn);
        }
    }
}

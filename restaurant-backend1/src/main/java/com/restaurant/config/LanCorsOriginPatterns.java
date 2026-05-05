package com.restaurant.config;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * Origin patterns cho CORS + SockJS khi FE chạy trên LAN (Live Server, điện thoại cùng Wi‑Fi).
 * Bổ sung thêm bằng biến môi trường {@code RESTAURANT_CORS_ORIGIN_PATTERNS} (phân tách bằng dấu phẩy).
 */
public final class LanCorsOriginPatterns {

    private LanCorsOriginPatterns() {
    }

    public static List<String> allowedOriginPatterns() {
        List<String> patterns = new ArrayList<>(List.of(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "http://[::1]:*",
                // 192.168.x.x, 10.x.x.x (RFC1918 thường gặp)
                "http://192.168.*.*:*",
                "http://10.*.*.*:*",
                "https://*"));
        for (int i = 16; i <= 31; i++) {
            patterns.add("http://172." + i + ".*.*:*");
        }
        String extra = System.getenv("RESTAURANT_CORS_ORIGIN_PATTERNS");
        if (StringUtils.hasText(extra)) {
            for (String raw : extra.split(",")) {
                String p = raw.trim();
                if (!p.isEmpty()) {
                    patterns.add(p);
                }
            }
        }
        return List.copyOf(patterns);
    }
}

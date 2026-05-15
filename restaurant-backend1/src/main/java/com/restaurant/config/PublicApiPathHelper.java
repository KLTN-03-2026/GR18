package com.restaurant.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

/**
 * Các request không cần xác thực JWT (khớp {@code PUBLIC_URLS} trong {@link SecurityConfig}).
 * Dùng path sau {@link HttpServletRequest#getContextPath()} vì với {@code server.servlet.context-path=/api},
 * {@code getServletPath()} có thể rỗng → filter JWT vẫn chạy trên {@code /auth/login} và token cũ gây lỗi.
 */
public final class PublicApiPathHelper {

    private PublicApiPathHelper() {
    }

    /** Path trong app, bắt đầu bằng {@code /}, không gồm context-path (vd. {@code /auth/login}). */
    public static String pathWithinApplication(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (!StringUtils.hasText(uri)) {
            return "/";
        }
        String context = request.getContextPath();
        if (StringUtils.hasText(context) && uri.startsWith(context)) {
            uri = uri.substring(context.length());
        }
        if (!uri.startsWith("/")) {
            uri = "/" + uri;
        }
        return uri;
    }

    public static boolean isAnonymousRequest(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = pathWithinApplication(request);
        if (!StringUtils.hasText(path)) {
            return false;
        }
        if (path.startsWith("/error")) {
            return true;
        }
        // /chat & /chatbot KHÔNG nằm trong danh sách anonymous: endpoint vẫn permitAll
        // ở SecurityConfig, nhưng cần để JWT filter chạy để parse token (nếu có) và
        // set Authentication. Nếu skip filter, user đã đăng nhập vẫn bị coi là null
        // → chatbot không đặt bàn được.
        return path.startsWith("/auth")
                || path.startsWith("/menu")
                || path.startsWith("/categories")
                || path.startsWith("/tables/qr")
                || path.startsWith("/tables/booking-options")
                || path.startsWith("/orders/guest")
                || path.startsWith("/call-staff/guest")
                || path.startsWith("/reviews/guest")
                || path.startsWith("/ws")
                || path.startsWith("/swagger")
                || path.startsWith("/v3")
                || path.startsWith("/api-docs");
    }
}

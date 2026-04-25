package com.restaurant.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

/**
 * Các request không cần xác thực JWT (khớp ý nghĩa với {@code PUBLIC_URLS} trong {@link SecurityConfig},
 * dùng {@link HttpServletRequest#getServletPath()} — không gồm context-path).
 */
public final class PublicApiPathHelper {

    private PublicApiPathHelper() {
    }

    public static boolean isAnonymousRequest(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getServletPath();
        if (!StringUtils.hasText(path)) {
            return false;
        }
        return path.startsWith("/auth")
                || path.startsWith("/menu")
                || path.startsWith("/categories")
                || path.startsWith("/tables/qr")
                || path.startsWith("/orders/guest")
                || path.startsWith("/call-staff/guest")
                || path.startsWith("/swagger")
                || path.startsWith("/v3")
                || path.startsWith("/api-docs");
    }
}

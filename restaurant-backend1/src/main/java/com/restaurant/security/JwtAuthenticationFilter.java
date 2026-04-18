package com.restaurant.security;

import com.restaurant.repository.BlacklistedTokenRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService userDetailsService;
    private final BlacklistedTokenRepository blacklistedTokenRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 🔥 FIX QUAN TRỌNG: dùng servletPath thay vì requestURI
        String path = request.getServletPath();

        log.info("Request path: {}", path);

        // ✅ Skip public APIs
        if (path.startsWith("/auth") ||
                path.startsWith("/menu") ||
                path.startsWith("/categories") ||
                path.startsWith("/swagger") ||
                path.startsWith("/v3") ||
                path.startsWith("/api-docs")) {

            filterChain.doFilter(request, response);
            return;
        }

        // ✅ Skip OPTIONS (CORS preflight)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = extractToken(request);

            log.info("Extracted token: {}", token);

            if (StringUtils.hasText(token)) {

                // 🔥 CHECK BLACKLIST
                if (blacklistedTokenRepository.existsByToken(token)) {
                    log.warn("Token đã bị thu hồi");
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token đã logout");
                    return;
                }

                if (jwtTokenProvider.validateToken(token)) {

                    Long userId = jwtTokenProvider.getUserIdFromToken(token);

                    UserDetails userDetails = userDetailsService.loadUserById(userId);

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );

                    authentication.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                    );

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }

        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");

        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        return null;
    }
}
package com.restaurant.service;

import com.restaurant.dto.request.LoginRequest;
import com.restaurant.dto.request.RegisterRequest;
import com.restaurant.dto.response.AuthResponse;
import com.restaurant.entity.BlacklistedToken;
import com.restaurant.entity.RefreshToken;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.UserRole;
import com.restaurant.repository.BlacklistedTokenRepository;
import com.restaurant.repository.RefreshTokenRepository;
import com.restaurant.repository.UserRepository;
import com.restaurant.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import java.util.Collections;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final BlacklistedTokenRepository blacklistedTokenRepository;

    public AuthResponse register(RegisterRequest request) {
        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email đã được sử dụng");
        }
        if (request.getPhone() != null && userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("Số điện thoại đã được sử dụng");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(UserRole.CUSTOMER)
                .isActive(true)
                .build();
        user = userRepository.save(user);

        return buildAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        User user = userRepository.findByEmailOrPhone(request.getUsername(), request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Thông tin đăng nhập không hợp lệ"));

        return buildAuthResponse(user);
    }

    public AuthResponse refreshToken(String refreshToken) {
        RefreshToken token = refreshTokenRepository.findByTokenAndIsRevokedFalse(refreshToken)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token không hợp lệ hoặc đã hết hạn"));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Refresh token đã hết hạn");
        }

        User user = token.getUser();
        return buildAuthResponse(user);
    }

    public void logout(Long userId, String accessToken) {

        // 1. Thu hồi refresh token (bạn đã làm đúng 👍)
        refreshTokenRepository.revokeAllByUserId(userId);

        // 2. Thêm access token vào blacklist
        blacklistedTokenRepository.save(
                BlacklistedToken.builder()
                        .token(accessToken)
                        .expiresAt(jwtTokenProvider.getExpirationDate(accessToken))
                        .build()
        );
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getRole().name());
        String refreshTokenValue = jwtTokenProvider.generateRefreshToken(user.getId());

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(refreshTokenValue)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .isRevoked(false)
                .build();
        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .tokenType("Bearer")
                .userId(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }
    public AuthResponse loginWithGoogle(String idTokenString) {
        try {
            // 1. Khởi tạo bộ xác thực của Google
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    // Thay Client ID của nhóm vào đây
                    .setAudience(Collections.singletonList("69603544612-rb1t7phvocsqs89p8ap2sj0dtb82tbig.apps.googleusercontent.com"))
                    .build();

            // 2. Verify token gửi từ Frontend
            GoogleIdToken idToken = verifier.verify(idTokenString);

            if (idToken != null) {
                Payload payload = idToken.getPayload();
                String email = payload.getEmail();
                String fullName = (String) payload.get("name");
                // String pictureUrl = (String) payload.get("picture"); // Có thể dùng cho Chatbot sau này

                // 3. Kiểm tra User trong DB
                User user = userRepository.findByEmail(email)
                        .orElseGet(() -> {
                            // Nếu chưa có thì tự động đăng ký (JIT Registration)
                            User newUser = User.builder()
                                    .email(email)
                                    .fullName(fullName)
                                    .role(UserRole.CUSTOMER)
                                    .isActive(true)
                                    .password(passwordEncoder.encode("GOOGLE_OAUTH_PASS_" + System.currentTimeMillis())) // Pass giả
                                    .build();
                            return userRepository.save(newUser);
                        });

                // 4. Tận dụng hàm buildAuthResponse xịn của nhóm để trả về JWT
                return buildAuthResponse(user);

            } else {
                throw new BadCredentialsException("Google ID Token không hợp lệ");
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi xác thực Google: " + e.getMessage());
        }
    }
}

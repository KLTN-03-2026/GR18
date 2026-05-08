package com.restaurant.service;

import com.restaurant.dto.request.LoginRequest;
import com.restaurant.dto.request.RegisterRequest;
import com.restaurant.dto.response.AuthResponse;
import com.restaurant.entity.BlacklistedToken;
import com.restaurant.entity.PasswordResetOtp;
import com.restaurant.entity.RefreshToken;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.UserRole;
import com.restaurant.repository.BlacklistedTokenRepository;
import com.restaurant.repository.PasswordResetOtpRepository;
import com.restaurant.repository.RefreshTokenRepository;
import com.restaurant.repository.UserRepository;
import com.restaurant.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.security.SecureRandom;

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
    private final PasswordResetOtpRepository passwordResetOtpRepository;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final long FORGOT_PASSWORD_COOLDOWN_SECONDS = 60;

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

        User user = userRepository.findByEmailOrPhone(request.getUsername())
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

    public void requestPasswordResetOtp(String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        String normalizedEmail = email.trim().toLowerCase();
        var userOpt = userRepository.findByEmail(normalizedEmail);
        if (userOpt.isEmpty()) {
            // Trả về success để tránh lộ email có tồn tại hay không.
            return;
        }
        passwordResetOtpRepository.findTopByEmailOrderByCreatedAtDesc(normalizedEmail).ifPresent(lastOtp -> {
            if (lastOtp.getCreatedAt() == null) {
                return;
            }
            long elapsedSeconds = Duration.between(lastOtp.getCreatedAt(), LocalDateTime.now()).getSeconds();
            if (elapsedSeconds < FORGOT_PASSWORD_COOLDOWN_SECONDS) {
                long waitSeconds = FORGOT_PASSWORD_COOLDOWN_SECONDS - Math.max(0, elapsedSeconds);
                throw new IllegalArgumentException("Vui lòng chờ " + waitSeconds + " giây trước khi gửi lại OTP.");
            }
        });

        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        passwordResetOtpRepository.markAllUnusedByEmailAsUsed(normalizedEmail);
        PasswordResetOtp otp = PasswordResetOtp.builder()
                .email(normalizedEmail)
                .otpCode(otpCode)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false)
                .build();
        passwordResetOtpRepository.save(otp);

        if (mailFrom == null || mailFrom.isBlank()) {
            System.out.println("[DEV] OTP reset password cho " + normalizedEmail + ": " + otpCode);
            return;
        }
        sendResetOtpMail(normalizedEmail, otpCode);
    }

    public void resetPasswordByOtp(String email, String otpCode, String newPassword) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email không được để trống");
        }
        if (otpCode == null || otpCode.isBlank()) {
            throw new IllegalArgumentException("Mã OTP không được để trống");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Mật khẩu mới phải từ 6 ký tự");
        }

        String normalizedEmail = email.trim().toLowerCase();
        PasswordResetOtp otp = passwordResetOtpRepository
                .findTopByEmailAndOtpCodeAndUsedFalseOrderByCreatedAtDesc(normalizedEmail, otpCode.trim())
                .orElseThrow(() -> new IllegalArgumentException("Mã OTP không hợp lệ"));

        if (otp.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Mã OTP đã hết hạn");
        }

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Email không hợp lệ"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(user.getId());

        otp.setUsed(true);
        passwordResetOtpRepository.save(otp);
    }

    private void sendResetOtpMail(String toEmail, String otpCode) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(toEmail);
            message.setSubject("[Restaurant AI] Mã OTP đặt lại mật khẩu");
            message.setText("""
                    Xin chào,

                    Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Restaurant AI.
                    Mã OTP của bạn là: %s
                    Mã có hiệu lực trong 10 phút.

                    Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
                    """.formatted(otpCode));
            mailSender.send(message);
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể gửi email OTP. Vui lòng thử lại sau.");
        }
    }

    public void logout(Authentication authentication, String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Thiếu hoặc sai định dạng header Authorization (Bearer).");
        }
        Long userId = Long.parseLong(authentication.getName());
        String accessToken = authorizationHeader.substring(7);
        logout(userId, accessToken);
    }

    public void logout(Long userId, String accessToken) {

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
                .phone(user.getPhone())
                .role(user.getRole())
                .build();
    }

    /**
     * Khách (hoặc tài khoản đã đăng nhập) cập nhật số điện thoại — 10 chữ số, không trùng user khác.
     */
    public String updateCustomerPhone(Long userId, String phoneDigits) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));
        if (phoneDigits == null || !phoneDigits.matches("\\d{10}")) {
            throw new IllegalArgumentException("Số điện thoại phải gồm đúng 10 chữ số");
        }
        String current = user.getPhone();
        if (!phoneDigits.equals(current) && userRepository.existsByPhone(phoneDigits)) {
            throw new IllegalArgumentException("Số điện thoại đã được sử dụng");
        }
        user.setPhone(phoneDigits);
        userRepository.save(user);
        return phoneDigits;
    }
    public AuthResponse loginWithGoogleRequest(Map<String, String> requestBody) {
        if (requestBody == null) {
            throw new IllegalArgumentException("Thiếu dữ liệu đăng nhập");
        }
        String idToken = requestBody.get("token");
        if (idToken == null || idToken.isBlank()) {
            throw new IllegalArgumentException("Thiếu token Google (field token)");
        }
        return loginWithGoogle(idToken);
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

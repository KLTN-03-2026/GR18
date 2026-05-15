package com.restaurant.service;

import com.restaurant.dto.request.CreateUserRequest;
import com.restaurant.dto.request.UpdateUserRequest;
import com.restaurant.dto.response.UserResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.UserRole;
import com.restaurant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service quản lý user (Admin tạo staff, quản lý tài khoản)
 */
@Service
@RequiredArgsConstructor
@Transactional
public class UserManagementService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private static final Set<String> STAFF_ALLOWED_PAGES = Set.of(
            "datcho.html",
            "donhang.html",
            "qltrangthaiban.html",
            "goinv.html",
            "qlthanhtoan.html"
    );

    /**
     * Admin tạo tài khoản Staff hoặc Admin khác
     */
    public UserResponse createUser(CreateUserRequest request) {
        // Validate
        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email đã được sử dụng");
        }
        if (request.getPhone() != null && userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("Số điện thoại đã được sử dụng");
        }

        // Tạo user với password đã mã hóa
        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword())) // ✅ MÃ HÓA PASSWORD
                .role(request.getRole())
                .allowedPagesJson(normalizeAllowedPagesJson(request.getAllowedPagesJson(), request.getRole()))
                .isActive(true)
                .build();

        user = userRepository.save(user);
        return toUserResponse(user);
    }

    /**
     * Cập nhật thông tin user (không đổi mật khẩu; dùng reset-password riêng)
     */
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy user"));

        user.setFullName(request.getFullName());

        String emailNorm = normalizeBlank(request.getEmail());
        if (emailNorm == null) {
            user.setEmail(null);
        } else if (!emailNorm.equals(user.getEmail())) {
            if (userRepository.existsByEmail(emailNorm)) {
                throw new IllegalArgumentException("Email đã được sử dụng");
            }
            user.setEmail(emailNorm);
        }

        String phoneNorm = normalizeBlank(request.getPhone());
        if (phoneNorm == null) {
            user.setPhone(null);
        } else if (!phoneNorm.equals(user.getPhone())) {
            if (userRepository.existsByPhone(phoneNorm)) {
                throw new IllegalArgumentException("Số điện thoại đã được sử dụng");
            }
            user.setPhone(phoneNorm);
        }

        user.setRole(request.getRole());
        user.setAllowedPagesJson(normalizeAllowedPagesJson(request.getAllowedPagesJson(), request.getRole()));

        user = userRepository.save(user);
        return toUserResponse(user);
    }

    private String normalizeAllowedPagesJson(String raw, UserRole role) {
        if (role != UserRole.STAFF) {
            return null;
        }
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            List<String> pages = objectMapper.readValue(raw, new TypeReference<List<String>>() {});
            List<String> sanitized = pages.stream()
                    .map(x -> x == null ? "" : x.trim())
                    .filter(x -> !x.isEmpty())
                    .filter(STAFF_ALLOWED_PAGES::contains)
                    .distinct()
                    .collect(Collectors.toList());
            if (sanitized.isEmpty()) return null;
            return objectMapper.writeValueAsString(sanitized);
        } catch (Exception e) {
            throw new IllegalArgumentException("Danh sách chức năng không hợp lệ");
        }
    }

    private static String normalizeBlank(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /**
     * Reset password user (Admin hoặc user tự reset)
     */
    public void resetPassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy user"));
        
        user.setPassword(passwordEncoder.encode(newPassword)); // ✅ MÃ HÓA PASSWORD
        userRepository.save(user);
    }

    /**
     * Vô hiệu hóa / kích hoạt tài khoản
     */
    public void toggleUserStatus(Long userId, boolean isActive) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy user"));
        user.setIsActive(isActive);
        userRepository.save(user);
    }

    /**
     * Xóa tài khoản (admin). Không xóa được nếu còn dữ liệu liên kết (đặt bàn, đơn, đánh giá…).
     */
    public void deleteUser(Long userId, Long actingAdminId) {
        if (actingAdminId != null && actingAdminId.equals(userId)) {
            throw new IllegalArgumentException("Không thể xóa tài khoản đang đăng nhập");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy user"));
        if (user.getRole() == UserRole.ADMIN) {
            long activeAdmins = userRepository.countByRoleAndIsActiveTrue(UserRole.ADMIN);
            if (activeAdmins <= 1 && Boolean.TRUE.equals(user.getIsActive())) {
                throw new IllegalStateException("Không thể xóa quản trị viên hoạt động cuối cùng");
            }
        }
        try {
            userRepository.delete(user);
        } catch (DataIntegrityViolationException ex) {
            throw new IllegalStateException(
                    "Không thể xóa tài khoản đã có đơn hàng, đặt bàn hoặc đánh giá. Hãy khóa tài khoản thay vì xóa.");
        }
    }

    /**
     * Lấy danh sách tất cả user
     */
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    /**
     * Lấy danh sách user theo role
     */
    public List<UserResponse> getUsersByRole(UserRole role) {
        return userRepository.findByRole(role).stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    public Page<UserResponse> getUsersPage(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        return userRepository.findAll(PageRequest.of(safePage, safeSize, Sort.by("createdAt").descending()))
                .map(this::toUserResponse);
    }

    public Page<UserResponse> getUsersByRolePage(UserRole role, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        return userRepository.findByRole(role, PageRequest.of(safePage, safeSize, Sort.by("createdAt").descending()))
                .map(this::toUserResponse);
    }

    /**
     * Lấy thông tin user theo ID
     */
    public UserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy user"));
        return toUserResponse(user);
    }

    /**
     * Lấy thực thể User từ thông tin Authentication (Token JWT)
     * Dùng cho Chatbot AI nhận diện người dùng
     */
    public User getCurrentUser(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        try {
            String userIdStr = authentication.getName();
            Long userId = Long.parseLong(userIdStr);

            return userRepository.findById(userId).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .allowedPagesJson(user.getAllowedPagesJson())
                .isActive(user.getIsActive())
                .avatarUrl(user.getAvatarUrl())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}


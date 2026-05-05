package com.restaurant.dto.request;

import com.restaurant.entity.enums.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Cập nhật user từ admin (không bắt buộc mật khẩu; đổi mật khẩu dùng endpoint reset-password).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUpdateUserRequest {

    @NotBlank(message = "Họ tên không được để trống")
    @Size(max = 100, message = "Họ tên tối đa 100 ký tự")
    private String fullName;

    @Size(max = 150, message = "Email tối đa 150 ký tự")
    private String email;

    /** Để trống = giữ nguyên SĐT hiện tại; nếu có thì 10 số bắt đầu 0 */
    private String phone;

    @NotNull(message = "Vai trò không được để trống")
    private UserRole role;
}

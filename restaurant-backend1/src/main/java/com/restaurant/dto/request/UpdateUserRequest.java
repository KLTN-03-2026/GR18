package com.restaurant.dto.request;

import com.restaurant.entity.enums.UserRole;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {

    @NotBlank(message = "Họ tên không được để trống")
    @Size(max = 100, message = "Họ tên tối đa 100 ký tự")
    private String fullName;

    @Email(message = "Email không hợp lệ")
    @Size(max = 150, message = "Email tối đa 150 ký tự")
    private String email;

    @Pattern(regexp = "^(|0\\d{9})$", message = "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0")
    private String phone;

    @NotNull(message = "Vai trò không được để trống")
    private UserRole role;
}

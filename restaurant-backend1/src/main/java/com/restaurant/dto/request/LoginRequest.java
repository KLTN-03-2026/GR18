package com.restaurant.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank(message = "Email hoặc số điện thoại không được để trống")
    private String username;    // email hoặc phone

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;
}

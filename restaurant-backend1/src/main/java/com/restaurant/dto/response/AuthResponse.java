package com.restaurant.dto.response;

import com.restaurant.entity.enums.UserRole;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long userId;
    private String fullName;
    private String email;
    private UserRole role;
}

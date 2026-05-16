package com.restaurant.exception;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.DisabledException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void handleDisabled_returnsLockedAccountMessage() {
    var response =
        handler.handleDisabled(
            new DisabledException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên."));

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getMessage()).contains("đã bị khóa");
  }
}

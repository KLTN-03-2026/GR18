package com.restaurant.exception;

import com.restaurant.dto.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import jakarta.persistence.PersistenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            if (error instanceof FieldError fe) {
                errors.put(fe.getField(), error.getDefaultMessage());
            } else {
                errors.put(error.getObjectName(), error.getDefaultMessage());
            }
        });
        String summary = errors.isEmpty()
                ? "Dữ liệu không hợp lệ"
                : (errors.size() == 1
                        ? errors.values().iterator().next()
                        : String.join(" ", errors.values()));
        return ApiResponse.<Map<String, String>>builder()
                .success(false)
                .message(summary)
                .data(errors)
                .build();
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, String>> handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getConstraintViolations().forEach(v -> {
            String key = v.getPropertyPath() != null ? v.getPropertyPath().toString() : "param";
            errors.put(key, v.getMessage());
        });
        return ApiResponse.error("Dữ liệu không hợp lệ: " + errors);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleIllegalArgument(IllegalArgumentException ex) {
        return ApiResponse.error(ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> handleIllegalState(IllegalStateException ex) {
        return ApiResponse.error(ex.getMessage());
    }

    @ExceptionHandler(BadCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> handleBadCredentials(BadCredentialsException ex) {
        return ApiResponse.error("Sai email/số điện thoại hoặc mật khẩu");
    }

    @ExceptionHandler(DisabledException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleDisabled(DisabledException ex) {
        String msg = ex.getMessage();
        if (msg == null || msg.isBlank()) {
            msg = "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.";
        }
        return ApiResponse.error(msg);
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> handleAccessDenied(AccessDeniedException ex) {
        return ApiResponse.error("Bạn không có quyền thực hiện hành động này");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public ApiResponse<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return ApiResponse.error("Phương thức HTTP không được hỗ trợ cho API này");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        return ApiResponse.error(
                "Thao tác vi phạm ràng buộc dữ liệu (ví dụ: email/phone trùng hoặc bản ghi đang được tham chiếu)");
    }

    @ExceptionHandler(PersistenceException.class)
    public ResponseEntity<ApiResponse<Void>> handlePersistence(PersistenceException ex) {
        log.error("Database persistence error: ", ex);
        String hint = ex.getMessage() != null && ex.getMessage().contains("reservation_id")
                ? "Thiếu cột reservation_id trên bảng orders — chạy db/manual/guest_order_qr_hotfix.sql hoặc bật ddl-auto=update."
                : "Đã xảy ra lỗi cơ sở dữ liệu. Vui lòng thử lại sau.";
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.error(hint));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unhandled exception: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."));
    }
}

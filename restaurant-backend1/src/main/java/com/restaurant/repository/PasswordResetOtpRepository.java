package com.restaurant.repository;

import com.restaurant.entity.PasswordResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, Long> {

    Optional<PasswordResetOtp> findTopByEmailAndOtpCodeAndUsedFalseOrderByCreatedAtDesc(String email, String otpCode);
    Optional<PasswordResetOtp> findTopByEmailOrderByCreatedAtDesc(String email);

    @Modifying
    @Query("UPDATE PasswordResetOtp p SET p.used = true WHERE p.email = :email AND p.used = false")
    int markAllUnusedByEmailAsUsed(@Param("email") String email);
}

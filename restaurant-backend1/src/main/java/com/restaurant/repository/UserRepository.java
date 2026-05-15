package com.restaurant.repository;

import com.restaurant.entity.User;
import com.restaurant.entity.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);

    @Query("SELECT u FROM User u WHERE u.email = :login OR u.phone = :login")
    Optional<User> findByEmailOrPhone(@Param("login") String login);
    Optional<User> findByOauthProviderAndOauthId(String oauthProvider, String oauthId);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    List<User> findByRole(UserRole role);
    Page<User> findByRole(UserRole role, Pageable pageable);
    List<User> findByIsActiveTrue();

    long countByRole(UserRole role);

    long countByRoleAndIsActiveTrue(UserRole role);
}

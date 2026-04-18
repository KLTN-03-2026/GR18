package com.restaurant.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Utility để generate BCrypt password hash
 * Chạy class này để tạo hash cho password cần update vào DB
 * 
 * Usage:
 * - Run main method
 * - Nhập password gốc (ví dụ: admin123, password, etc.)
 * - Copy BCrypt hash vào file migration SQL
 */
public class PasswordHashGenerator {

    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        // Danh sách password cần hash
        String[] passwords = {
                "password",      // Password mặc định cho test
                "admin123",      // Password admin
                "Admin@123",     // Password admin mạnh hơn
                "staff123",      // Password staff
                "customer123"    // Password customer
        };

        System.out.println("===== BCrypt Password Hash Generator =====\n");
        
        for (String password : passwords) {
            String hash = encoder.encode(password);
            System.out.println("Plain Text: " + password);
            System.out.println("BCrypt Hash: " + hash);
            System.out.println("Length: " + hash.length() + " characters");
            System.out.println("SQL Update Example:");
            System.out.println("UPDATE users SET password = '" + hash + "' WHERE email = 'your@email.com';");
            System.out.println("\n" + "=".repeat(80) + "\n");
        }

        // Verification example
        System.out.println("===== Verification Example =====");
        String testPassword = "password";
        String testHash = encoder.encode(testPassword);
        boolean matches = encoder.matches(testPassword, testHash);
        System.out.println("Test Password: " + testPassword);
        System.out.println("Test Hash: " + testHash);
        System.out.println("Matches: " + matches);
    }

    /**
     * Sử dụng method này trong code nếu cần hash động
     */
    public static String hashPassword(String plainPassword) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        return encoder.encode(plainPassword);
    }

    /**
     * Verify password
     */
    public static boolean verifyPassword(String plainPassword, String hashedPassword) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        return encoder.matches(plainPassword, hashedPassword);
    }
}


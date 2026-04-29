package com.restaurant.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Cấu hình AI toàn hệ thống (một dòng duy nhất, id = 1).
 */
@Entity
@Table(name = "ai_system_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiSystemConfig {

    public static final long SINGLETON_ID = 1L;

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "ai_enabled", nullable = false)
    @Builder.Default
    private Boolean aiEnabled = true;

    /** Bật gọi Gemini khi có API key; nếu false chỉ dùng rule + DB nội bộ. */
    @Column(name = "gemini_enabled", nullable = false)
    @Builder.Default
    private Boolean geminiEnabled = true;

    /** JSON mảng id món ưu tiên hiển thị đầu (do admin chọn). */
    @Column(name = "pinned_menu_item_ids_json", length = 4000)
    @Builder.Default
    private String pinnedMenuItemIdsJson = "[]";

    /** Rỗng [] = mọi danh mục; ngược lại chỉ gợi ý trong các category id. */
    @Column(name = "restrict_category_ids_json", length = 2000)
    @Builder.Default
    private String restrictCategoryIdsJson = "[]";

    @Column(name = "history_lookback_days", nullable = false)
    @Builder.Default
    private Integer historyLookbackDays = 90;

    @Column(name = "rating_weight", nullable = false)
    @Builder.Default
    private Double ratingWeight = 0.65;

    @Column(name = "sales_weight", nullable = false)
    @Builder.Default
    private Double salesWeight = 0.35;

    @Column(name = "gemini_timeout_ms", nullable = false)
    @Builder.Default
    private Integer geminiTimeoutMs = 2800;

    @Column(name = "anonymize_analytics", nullable = false)
    @Builder.Default
    private Boolean anonymizeAnalytics = true;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }
}

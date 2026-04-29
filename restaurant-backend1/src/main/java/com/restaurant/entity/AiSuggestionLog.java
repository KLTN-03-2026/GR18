package com.restaurant.entity;

import com.restaurant.entity.enums.AiSuggestionSource;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Ghi nhận lượt gợi ý (không lưu tin nhắn người dùng — chỉ hash phiên + id món).
 */
@Entity
@Table(name = "ai_suggestion_logs", indexes = {
        @Index(name = "idx_ai_suggestion_created", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiSuggestionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** SHA-256 hex của sessionId — không lưu session gốc. */
    @Column(name = "session_hash", nullable = false, length = 64)
    private String sessionHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private AiSuggestionSource source;

    @Column(name = "suggested_item_ids_json", nullable = false, length = 4000)
    private String suggestedItemIdsJson;

    @Column(name = "reply_preview", length = 500)
    private String replyPreview;

    @Column(name = "accepted_menu_item_id")
    private Long acceptedMenuItemId;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}

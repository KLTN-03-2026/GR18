package com.restaurant.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "reviews",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_review_order",
                columnNames = {"order_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null khi đánh giá vãng lai (quét QR, không tài khoản). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = true)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User user;

    @Column(name = "guest_name", length = 100)
    private String guestName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "orderItems", "reviews"})
    private MenuItem menuItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "orderItems", "reservation"})
    private Order order;

    @Column(name = "rating", nullable = false)
    private Integer rating;     // 1 - 5

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "is_visible", nullable = false)
    @Builder.Default
    private Boolean isVisible = true;
}

package com.restaurant.repository;

import com.restaurant.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long>, JpaSpecificationExecutor<Review> {
    Page<Review> findByMenuItemIdAndIsVisibleTrue(Long menuItemId, Pageable pageable);

    List<Review> findByMenuItemIdAndIsVisibleTrue(Long menuItemId);

    Page<Review> findByIsVisibleTrueOrderByCreatedAtDesc(Pageable pageable);

    Optional<Review> findByOrder_Id(Long orderId);

    Optional<Review> findByUser_IdAndOrder_Id(Long userId, Long orderId);

    Optional<Review> findByIdAndUser_Id(Long id, Long userId);

    @Query("""
            SELECT DISTINCT r FROM Review r
            JOIN FETCH r.user u
            JOIN FETCH r.menuItem m
            JOIN FETCH m.category
            JOIN FETCH r.order o
            LEFT JOIN FETCH o.table
            LEFT JOIN FETCH o.user
            WHERE u.id = :userId
            ORDER BY r.createdAt DESC
            """)
    List<Review> findByUserIdWithAssociations(@Param("userId") Long userId);

    @Query("""
            SELECT DISTINCT r FROM Review r
            LEFT JOIN FETCH r.user
            JOIN FETCH r.menuItem m
            JOIN FETCH m.category
            JOIN FETCH r.order o
            LEFT JOIN FETCH o.table
            LEFT JOIN FETCH o.user
            WHERE r.user IS NULL AND r.order.table.id = :tableId
            ORDER BY r.createdAt DESC
            """)
    List<Review> findGuestReviewsByTableId(@Param("tableId") Long tableId);

    @Query("""
            SELECT DISTINCT r FROM Review r
            LEFT JOIN FETCH r.user
            JOIN FETCH r.menuItem m
            JOIN FETCH m.category
            JOIN FETCH r.order o
            LEFT JOIN FETCH o.table
            LEFT JOIN FETCH o.user
            WHERE r.menuItem.id = :menuItemId AND r.isVisible = true
            ORDER BY r.createdAt DESC
            """)
    List<Review> findVisibleByMenuItemWithAssociations(
            @Param("menuItemId") Long menuItemId,
            Pageable pageable);

    @Query("""
            SELECT DISTINCT r FROM Review r
            LEFT JOIN FETCH r.user
            JOIN FETCH r.menuItem m
            JOIN FETCH m.category
            JOIN FETCH r.order o
            LEFT JOIN FETCH o.table
            LEFT JOIN FETCH o.user
            WHERE r.isVisible = true
            ORDER BY r.createdAt DESC
            """)
    List<Review> findAllVisibleWithAssociations(Pageable pageable);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.menuItem.id = :menuItemId AND r.isVisible = true")
    Double calculateAvgRatingByMenuItem(@Param("menuItemId") Long menuItemId);

    /** Tải đủ quan hệ cần thiết trước khi serialize JSON (tránh LazyInitializationException). */
    @Query("""
            SELECT DISTINCT r FROM Review r
            LEFT JOIN FETCH r.user
            JOIN FETCH r.menuItem m
            JOIN FETCH m.category
            JOIN FETCH r.order o
            LEFT JOIN FETCH o.table
            LEFT JOIN FETCH o.user
            WHERE r.id = :id
            """)
    Optional<Review> findByIdWithAssociationsForApi(@Param("id") Long id);
}

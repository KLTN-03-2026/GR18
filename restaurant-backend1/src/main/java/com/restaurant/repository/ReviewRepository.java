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

    List<Review> findByUser_IdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT r FROM Review r WHERE r.user IS NULL AND r.order.table.id = :tableId ORDER BY r.createdAt DESC")
    List<Review> findGuestReviewsByTableId(@Param("tableId") Long tableId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.menuItem.id = :menuItemId AND r.isVisible = true")
    Double calculateAvgRatingByMenuItem(@Param("menuItemId") Long menuItemId);
}

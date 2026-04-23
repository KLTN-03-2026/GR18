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
    List<Review> findByUserId(Long userId);
    Optional<Review> findByUserIdAndOrderId(Long userId, Long orderId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.menuItem.id = :menuItemId AND r.isVisible = true")
    Double calculateAvgRatingByMenuItem(@Param("menuItemId") Long menuItemId);
}

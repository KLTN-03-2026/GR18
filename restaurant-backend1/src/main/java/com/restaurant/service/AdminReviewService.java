package com.restaurant.service;

import com.restaurant.entity.Review;
import com.restaurant.repository.ReviewRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminReviewService {

    private final ReviewRepository reviewRepository;

    @Transactional(readOnly = true)
    public Page<Review> findReviewsForAdmin(
            Long menuItemId,
            Long userId,
            Integer minRating,
            Integer maxRating,
            Boolean isVisible,
            Pageable pageable) {
        Specification<Review> spec = withAdminFilters(menuItemId, userId, minRating, maxRating, isVisible);
        return reviewRepository.findAll(spec, pageable);
    }

    private static Specification<Review> withAdminFilters(
            Long menuItemId,
            Long userId,
            Integer minRating,
            Integer maxRating,
            Boolean isVisible) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (menuItemId != null) {
                predicates.add(cb.equal(root.get("menuItem").get("id"), menuItemId));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("user").get("id"), userId));
            }
            if (isVisible != null) {
                predicates.add(cb.equal(root.get("isVisible"), isVisible));
            }
            int min = minRating != null ? minRating : 1;
            int max = maxRating != null ? maxRating : 5;
            predicates.add(cb.between(root.get("rating"), min, max));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    @Transactional(readOnly = true)
    public Review getByIdOrThrow(Long id) {
        return reviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Đánh giá không tồn tại"));
    }

    @Transactional
    public Review setVisibility(Long id, boolean visible) {
        Review review = getByIdOrThrow(id);
        review.setIsVisible(visible);
        return reviewRepository.save(review);
    }

    @Transactional
    public void deleteById(Long id) {
        Review review = getByIdOrThrow(id);
        reviewRepository.delete(review);
    }
}

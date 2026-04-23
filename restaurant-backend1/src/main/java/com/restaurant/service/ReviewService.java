package com.restaurant.service;

import com.restaurant.dto.request.SubmitReviewRequest;
import com.restaurant.entity.MenuItem;
import com.restaurant.entity.Order;
import com.restaurant.entity.Review;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.repository.MenuItemRepository;
import com.restaurant.repository.OrderRepository;
import com.restaurant.repository.ReviewRepository;
import com.restaurant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<Review> listVisibleByMenuItem(Long menuItemId, int page, int size) {
        return reviewRepository
                .findByMenuItemIdAndIsVisibleTrue(menuItemId, PageRequest.of(page, size))
                .getContent();
    }

    @Transactional
    public Review submitReview(Long userId, SubmitReviewRequest request) {
        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("Bạn không có quyền đánh giá đơn hàng này");
        }
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new IllegalStateException("Chỉ có thể đánh giá sau khi đơn hàng hoàn thành");
        }
        if (reviewRepository.findByUserIdAndOrderId(userId, request.getOrderId()).isPresent()) {
            throw new IllegalStateException("Đơn hàng này đã được đánh giá rồi");
        }

        MenuItem menuItem = menuItemRepository.findById(request.getMenuItemId())
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại"));

        Review review = Review.builder()
                .user(user)
                .menuItem(menuItem)
                .order(order)
                .rating(request.getRating())
                .comment(request.getComment())
                .isVisible(true)
                .build();
        Review saved = reviewRepository.save(review);

        Double avg = reviewRepository.calculateAvgRatingByMenuItem(menuItem.getId());
        menuItem.setAvgRating(avg != null ? BigDecimal.valueOf(avg) : BigDecimal.ZERO);
        menuItemRepository.save(menuItem);

        return saved;
    }
}

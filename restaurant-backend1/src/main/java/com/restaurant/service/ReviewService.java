package com.restaurant.service;

import com.restaurant.dto.request.GuestSubmitReviewRequest;
import com.restaurant.dto.request.SubmitReviewRequest;
import com.restaurant.dto.request.UpdateReviewRequest;
import com.restaurant.dto.response.review.EligibleOrderForReviewDto;
import com.restaurant.dto.response.review.EligibleOrderLineForReviewDto;
import com.restaurant.entity.MenuItem;
import com.restaurant.entity.Order;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.Review;
import com.restaurant.entity.User;
import com.restaurant.entity.enums.OrderStatus;
import com.restaurant.entity.enums.PaymentStatus;
import com.restaurant.repository.MenuItemRepository;
import com.restaurant.repository.OrderRepository;
import com.restaurant.repository.RestaurantTableRepository;
import com.restaurant.repository.ReviewRepository;
import com.restaurant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final RestaurantTableRepository tableRepository;

    @Transactional(readOnly = true)
    public List<Review> listVisibleByMenuItem(Long menuItemId, int page, int size) {
        return reviewRepository
                .findByMenuItemIdAndIsVisibleTrue(menuItemId, PageRequest.of(page, size))
                .getContent();
    }

    @Transactional(readOnly = true)
    public List<Review> listAllVisible(int page, int size) {
        return reviewRepository
                .findByIsVisibleTrueOrderByCreatedAtDesc(PageRequest.of(page, size))
                .getContent();
    }

    @Transactional(readOnly = true)
    public List<Review> listMyReviews(Long userId) {
        return reviewRepository.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<EligibleOrderForReviewDto> listEligibleOrdersForReview(Long userId) {
        List<Order> raw = orderRepository.findCompletedPaidWithItemsByUserId(userId);
        Map<Long, Order> byId = new LinkedHashMap<>();
        for (Order o : raw) {
            byId.putIfAbsent(o.getId(), o);
        }
        List<Order> orders = new ArrayList<>(byId.values());
        List<EligibleOrderForReviewDto> out = new ArrayList<>();
        for (Order o : orders) {
            if (reviewRepository.findByOrder_Id(o.getId()).isPresent()) {
                continue;
            }
            out.add(buildEligibleDto(o));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<EligibleOrderForReviewDto> listEligibleGuestOrdersForReview(String qrCodeToken) {
        if (!StringUtils.hasText(qrCodeToken)) {
            throw new IllegalArgumentException("Thiếu mã QR bàn");
        }
        RestaurantTable table = tableRepository.findByQrCodeToken(qrCodeToken.trim())
                .orElseThrow(() -> new IllegalArgumentException("Mã QR không hợp lệ"));
        List<Order> raw = orderRepository.findCompletedPaidGuestOrdersByTableId(table.getId());
        Map<Long, Order> byId = new LinkedHashMap<>();
        for (Order o : raw) {
            byId.putIfAbsent(o.getId(), o);
        }
        List<EligibleOrderForReviewDto> out = new ArrayList<>();
        for (Order o : byId.values()) {
            if (reviewRepository.findByOrder_Id(o.getId()).isPresent()) {
                continue;
            }
            out.add(buildEligibleDto(o));
        }
        return out;
    }

    private EligibleOrderForReviewDto buildEligibleDto(Order o) {
        List<EligibleOrderLineForReviewDto> lines = o.getOrderItems().stream()
                .map(oi -> EligibleOrderLineForReviewDto.builder()
                        .menuItemId(oi.getMenuItem().getId())
                        .menuItemName(oi.getMenuItem().getName())
                        .imageUrl(oi.getMenuItem().getImageUrl())
                        .quantity(oi.getQuantity() != null ? oi.getQuantity() : 0)
                        .build())
                .collect(Collectors.toList());
        String tableInfo = o.getTable() != null ? "Bàn " + o.getTable().getTableNumber() : "—";
        return EligibleOrderForReviewDto.builder()
                .orderId(o.getId())
                .paidAt(o.getPaidAt())
                .tableInfo(tableInfo)
                .lines(lines)
                .build();
    }

    @Transactional(readOnly = true)
    public List<Review> listGuestReviewsForTable(String qrCodeToken) {
        if (!StringUtils.hasText(qrCodeToken)) {
            throw new IllegalArgumentException("Thiếu mã QR bàn");
        }
        RestaurantTable table = tableRepository.findByQrCodeToken(qrCodeToken.trim())
                .orElseThrow(() -> new IllegalArgumentException("Mã QR không hợp lệ"));
        return reviewRepository.findGuestReviewsByTableId(table.getId());
    }

    @Transactional
    public Review submitReview(Long userId, SubmitReviewRequest request) {
        Order order = orderRepository.findDetailById(request.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("Bạn không có quyền đánh giá đơn hàng này");
        }
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new IllegalStateException("Chỉ có thể đánh giá sau khi đơn hàng đã hoàn thành");
        }
        if (order.getPaymentStatus() != PaymentStatus.PAID) {
            throw new IllegalStateException("Chỉ có thể đánh giá sau khi đơn hàng đã thanh toán thành công");
        }
        if (reviewRepository.findByOrder_Id(request.getOrderId()).isPresent()) {
            throw new IllegalStateException("Mỗi đơn hàng chỉ được đánh giá một lần");
        }

        if (!orderContainsMenuItem(order, request.getMenuItemId())) {
            throw new IllegalArgumentException("Món ăn không thuộc đơn hàng này");
        }

        MenuItem menuItem = menuItemRepository.findById(request.getMenuItemId())
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại"));

        Review review = Review.builder()
                .user(user)
                .guestName(null)
                .menuItem(menuItem)
                .order(order)
                .rating(request.getRating())
                .comment(request.getComment().trim())
                .isVisible(true)
                .build();
        Review saved = reviewRepository.save(review);
        refreshMenuItemAverageRating(menuItem.getId());
        return saved;
    }

    @Transactional
    public Review submitGuestReview(GuestSubmitReviewRequest request) {
        Order order = orderRepository.findDetailById(request.getOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Đơn hàng không tồn tại"));
        if (order.getUser() != null) {
            throw new IllegalStateException("Đơn này gắn tài khoản — vui lòng đăng nhập để đánh giá");
        }
        assertOrderMatchesGuestQr(order, request.getQrCodeToken().trim());
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new IllegalStateException("Chỉ có thể đánh giá sau khi đơn hàng đã hoàn thành");
        }
        if (order.getPaymentStatus() != PaymentStatus.PAID) {
            throw new IllegalStateException("Chỉ có thể đánh giá sau khi đơn hàng đã thanh toán thành công");
        }
        if (reviewRepository.findByOrder_Id(order.getId()).isPresent()) {
            throw new IllegalStateException("Mỗi đơn hàng chỉ được đánh giá một lần");
        }
        if (!orderContainsMenuItem(order, request.getMenuItemId())) {
            throw new IllegalArgumentException("Món ăn không thuộc đơn hàng này");
        }

        MenuItem menuItem = menuItemRepository.findById(request.getMenuItemId())
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));
        String display = StringUtils.hasText(order.getGuestName()) ? order.getGuestName().trim() : "Khách";

        Review review = Review.builder()
                .user(null)
                .guestName(display.length() > 100 ? display.substring(0, 100) : display)
                .menuItem(menuItem)
                .order(order)
                .rating(request.getRating())
                .comment(request.getComment().trim())
                .isVisible(true)
                .build();
        Review saved = reviewRepository.save(review);
        refreshMenuItemAverageRating(menuItem.getId());
        return saved;
    }

    private void assertOrderMatchesGuestQr(Order order, String qrCodeToken) {
        if (order.getTable() == null || !StringUtils.hasText(order.getTable().getQrCodeToken())) {
            throw new IllegalStateException("Đơn không gắn bàn hợp lệ");
        }
        if (!order.getTable().getQrCodeToken().equals(qrCodeToken)) {
            throw new AccessDeniedException("Mã QR không khớp với bàn của đơn hàng này");
        }
    }

    @Transactional
    public Review updateGuestReview(Long reviewId, String qrCodeToken, UpdateReviewRequest request) {
        if (!StringUtils.hasText(qrCodeToken)) {
            throw new IllegalArgumentException("Thiếu mã QR bàn");
        }
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đánh giá"));
        if (review.getUser() != null) {
            throw new AccessDeniedException("Dùng tài khoản để sửa đánh giá này");
        }
        assertOrderMatchesGuestQr(review.getOrder(), qrCodeToken.trim());
        review.setRating(request.getRating());
        review.setComment(request.getComment().trim());
        Review saved = reviewRepository.save(review);
        refreshMenuItemAverageRating(saved.getMenuItem().getId());
        return saved;
    }

    @Transactional
    public void deleteGuestReview(Long reviewId, String qrCodeToken) {
        if (!StringUtils.hasText(qrCodeToken)) {
            throw new IllegalArgumentException("Thiếu mã QR bàn");
        }
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đánh giá"));
        if (review.getUser() != null) {
            throw new AccessDeniedException("Dùng tài khoản để xóa đánh giá này");
        }
        assertOrderMatchesGuestQr(review.getOrder(), qrCodeToken.trim());
        Long menuItemId = review.getMenuItem().getId();
        reviewRepository.delete(review);
        refreshMenuItemAverageRating(menuItemId);
    }

    private static boolean orderContainsMenuItem(Order order, Long menuItemId) {
        return order.getOrderItems().stream()
                .anyMatch(oi -> oi.getMenuItem() != null && oi.getMenuItem().getId().equals(menuItemId));
    }

    @Transactional
    public Review updateMyReview(Long userId, Long reviewId, UpdateReviewRequest request) {
        Review review = reviewRepository.findByIdAndUser_Id(reviewId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đánh giá hoặc bạn không có quyền"));
        review.setRating(request.getRating());
        review.setComment(request.getComment().trim());
        Review saved = reviewRepository.save(review);
        refreshMenuItemAverageRating(saved.getMenuItem().getId());
        return saved;
    }

    @Transactional
    public void deleteMyReview(Long userId, Long reviewId) {
        Review review = reviewRepository.findByIdAndUser_Id(reviewId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đánh giá hoặc bạn không có quyền"));
        Long menuItemId = review.getMenuItem().getId();
        reviewRepository.delete(review);
        refreshMenuItemAverageRating(menuItemId);
    }

    public void refreshMenuItemAverageRating(Long menuItemId) {
        Double avg = reviewRepository.calculateAvgRatingByMenuItem(menuItemId);
        MenuItem menuItem = menuItemRepository.findById(menuItemId).orElse(null);
        if (menuItem == null) {
            return;
        }
        menuItem.setAvgRating(avg != null ? BigDecimal.valueOf(avg) : BigDecimal.ZERO);
        menuItemRepository.save(menuItem);
    }
}

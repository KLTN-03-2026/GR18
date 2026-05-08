-- Cho phép đánh giá khách vãng lai (không đăng nhập): user_id có thể NULL.
ALTER TABLE reviews
    MODIFY COLUMN user_id BIGINT NULL;

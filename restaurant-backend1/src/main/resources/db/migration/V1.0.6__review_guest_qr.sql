-- Khách QR đánh giá: khi bật Flyway, cập nhật DB tương ứng entity Review (user_id NULL, cột guest_name, unique 1 review / order_id).
-- Nếu dùng ddl-auto=update: Hibernate có thể tự thêm cột. Cần xóa index cũ uq_review_user_order_item bằng tay nếu trùng lỗi, rồi:
-- ALTER TABLE reviews DROP INDEX uq_review_user_order_item;
-- CREATE UNIQUE INDEX uq_review_order ON reviews (order_id);

SELECT 1;

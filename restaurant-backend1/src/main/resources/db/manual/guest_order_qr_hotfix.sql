-- Chạy thủ công trên production nếu POST /orders/guest trả 500 (thiếu cột).
-- Bỏ qua từng lệnh nếu báo "Duplicate column" / constraint đã tồn tại.

ALTER TABLE orders ADD COLUMN reservation_id BIGINT NULL;
ALTER TABLE orders ADD CONSTRAINT fk_orders_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_reservation_id ON orders (reservation_id);

ALTER TABLE order_items ADD COLUMN added_to_order_at DATETIME NULL;

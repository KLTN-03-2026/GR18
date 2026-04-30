-- Liên kết đơn món với đặt bàn (khách có tài khoản, đã đến bàn, gọi món qua QR)
ALTER TABLE orders
    ADD COLUMN reservation_id BIGINT NULL AFTER user_id;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_reservation_id ON orders (reservation_id);

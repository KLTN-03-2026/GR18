-- Món gọi thêm sau khi đặt đơn: đánh dấu thời điểm thêm (NULL = dòng tạo cùng đơn ban đầu)
ALTER TABLE order_items
    ADD COLUMN added_to_order_at DATETIME NULL DEFAULT NULL AFTER status;

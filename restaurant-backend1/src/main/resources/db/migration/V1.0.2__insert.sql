-- 1. Chèn tài khoản mẫu (Password: Admin@123)
INSERT INTO users (full_name, email, phone, password, role, created_at, updated_at) VALUES
                                                                                        ('Admin Hệ Thống',  'admin@restaurant.com',  '0900000001', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'ADMIN', NOW(), NOW()),
                                                                                        ('Nhân Viên A',     'staff1@restaurant.com', '0900000002', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'STAFF', NOW(), NOW()),
                                                                                        ('Khách Hàng Mẫu',  'customer@gmail.com',    '0912345678', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'CUSTOMER', NOW(), NOW());

-- 2. Chèn bàn ăn mẫu
INSERT INTO restaurant_tables (table_number, capacity, location, status, qr_code_token, created_at, updated_at)
VALUES ('A01', 2, 'Tầng 1', 'AVAILABLE', UUID(), NOW(), NOW()),
       ('A02', 4, 'Tầng 1', 'AVAILABLE', UUID(), NOW(), NOW()),
       ('B01', 4, 'Tầng 2', 'AVAILABLE', UUID(), NOW(), NOW());

-- 3. Chèn danh mục (Ép ID 1, 2, 3)
INSERT INTO categories (id, name, description, sort_order, created_at, updated_at)
VALUES (1, 'Khai Vị', 'Món nhẹ', 1, NOW(), NOW()),
       (2, 'Món Chính', 'Món đặc trưng', 2, NOW(), NOW()),
       (3, 'Đồ Uống', 'Giải khát', 3, NOW(), NOW());

-- 4. Chèn món ăn mẫu
INSERT INTO menu_items (category_id, name, description, price, is_available, created_at, updated_at)
VALUES (1, 'Gỏi Cuốn', 'Gỏi tôm thịt', 45000, TRUE, NOW(), NOW()),
       (2, 'Bò Lúc Lắc', 'Bò mềm sốt', 165000, TRUE, NOW(), NOW()),
       (3, 'Cafe Sữa', 'Cafe pha phin', 30000, TRUE, NOW(), NOW());

-- 5. Tạo VIEW báo cáo bàn
CREATE OR REPLACE VIEW v_table_status AS
SELECT rt.id, rt.table_number, rt.capacity, rt.location, rt.status,
       COUNT(CASE WHEN o.status NOT IN ('COMPLETED', 'CANCELLED') THEN o.id END) AS active_orders
FROM restaurant_tables rt
         LEFT JOIN orders o ON rt.id = o.table_id
WHERE rt.is_active = TRUE
GROUP BY rt.id, rt.table_number, rt.capacity, rt.location, rt.status;

-- 6. Tạo VIEW Top món ăn (Sửa lỗi GROUP BY cho MySQL Strict)
CREATE OR REPLACE VIEW v_top_menu_items AS
SELECT mi.id, mi.name, c.name AS category, mi.price, mi.total_sold, mi.avg_rating,
       COALESCE(SUM(oi.quantity), 0) AS total_quantity
FROM menu_items mi
         JOIN categories c ON mi.category_id = c.id
         LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
WHERE mi.is_active = TRUE
GROUP BY mi.id, mi.name, c.name, mi.price, mi.total_sold, mi.avg_rating
ORDER BY mi.total_sold DESC LIMIT 10;
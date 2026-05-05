-- ============================================================
--  Restaurant QR Ordering System - Database Setup Script
--  Database: MySQL 8.0+
--  Schema: restaurant_db
--  Nhóm 18 - ĐH Duy Tân
-- ============================================================

-- Tạo và chọn database
CREATE DATABASE IF NOT EXISTS restaurant_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE restaurant_db;

-- ============================================================
-- BẢNG 1: users - Tài khoản người dùng
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(100)        NOT NULL,
    email         VARCHAR(150)        UNIQUE,
    phone         VARCHAR(15)         UNIQUE,
    password      VARCHAR(255),
    role          ENUM('CUSTOMER','STAFF','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
    oauth_provider VARCHAR(50),
    oauth_id      VARCHAR(200),
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_email   (email),
    INDEX idx_users_phone   (phone),
    INDEX idx_users_role    (role)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 2: restaurant_tables - Bàn ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_number    VARCHAR(20)         NOT NULL UNIQUE,
    capacity        INT                 NOT NULL,
    location        VARCHAR(100),
    status          ENUM('AVAILABLE','RESERVED','OCCUPIED','CLEANING') NOT NULL DEFAULT 'AVAILABLE',
    qr_code_url     VARCHAR(500),
    qr_code_token   VARCHAR(100)        UNIQUE,
    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tables_status       (status),
    INDEX idx_tables_qr_token     (qr_code_token)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 3: categories - Danh mục món ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL,
    description TEXT,
    image_url   VARCHAR(500),
    sort_order  INT             NOT NULL DEFAULT 0,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 4: menu_items - Món ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id  BIGINT          NOT NULL,
    name         VARCHAR(200)    NOT NULL,
    description  TEXT,
    price        DECIMAL(12,0)   NOT NULL,
    image_url    VARCHAR(500),
    is_available BOOLEAN         NOT NULL DEFAULT TRUE,
    is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
    total_sold   INT             NOT NULL DEFAULT 0,
    avg_rating   DOUBLE          NOT NULL DEFAULT 0,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_menu_category    (category_id),
    INDEX idx_menu_available   (is_available, is_active),
    FULLTEXT INDEX ft_menu_name (name, description)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 5: reservations - Đặt bàn
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id          BIGINT          NOT NULL,
    table_id         BIGINT,
    reservation_time DATETIME        NOT NULL,
    number_of_guests INT             NOT NULL,
    customer_name    VARCHAR(100)    NOT NULL,
    customer_phone   VARCHAR(15)     NOT NULL,
    note             TEXT,
    status           ENUM('PENDING','CONFIRMED','ARRIVED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    confirmed_at     DATETIME,
    arrived_at       DATETIME,
    cancelled_at     DATETIME,
    cancel_reason    TEXT,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_res_user  FOREIGN KEY (user_id)  REFERENCES users(id),
    CONSTRAINT fk_res_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id),
    INDEX idx_res_user        (user_id),
    INDEX idx_res_table       (table_id),
    INDEX idx_res_time        (reservation_time),
    INDEX idx_res_status      (status)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 6: orders - Đơn hàng
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_id        BIGINT,
    user_id         BIGINT,
    guest_name      VARCHAR(100),
    status          ENUM('PENDING','PREPARING','SERVING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    total_amount    DECIMAL(12,0)   NOT NULL DEFAULT 0,
    payment_status  ENUM('UNPAID','PAID','REFUNDED')          NOT NULL DEFAULT 'UNPAID',
    payment_method  ENUM('CASH','QR_CODE'),
    paid_at         DATETIME,
    note            TEXT,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id),
    CONSTRAINT fk_order_user  FOREIGN KEY (user_id)  REFERENCES users(id),
    INDEX idx_order_table          (table_id),
    INDEX idx_order_user           (user_id),
    INDEX idx_order_status         (status),
    INDEX idx_order_payment_status (payment_status),
    INDEX idx_order_paid_at        (paid_at)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 7: order_items - Chi tiết đơn hàng (từng món)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id     BIGINT          NOT NULL,
    menu_item_id BIGINT          NOT NULL,
    quantity     INT             NOT NULL,
    unit_price   DECIMAL(12,0)   NOT NULL,
    subtotal     DECIMAL(12,0)   NOT NULL,
    note         VARCHAR(500),   -- Ghi chú: "ít cay", "không hành", topping...
    status       ENUM('PENDING','PREPARING','READY','SERVED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_item_order     FOREIGN KEY (order_id)     REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
    INDEX idx_order_item_order     (order_id),
    INDEX idx_order_item_menu_item (menu_item_id),
    INDEX idx_order_item_status    (status)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 8: reviews - Đánh giá món ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT          NOT NULL,
    menu_item_id BIGINT          NOT NULL,
    order_id     BIGINT          NOT NULL,
    rating       TINYINT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT,
    is_visible   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_user      FOREIGN KEY (user_id)      REFERENCES users(id),
    CONSTRAINT fk_review_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
    CONSTRAINT fk_review_order     FOREIGN KEY (order_id)     REFERENCES orders(id),
    UNIQUE KEY uq_review_user_order (user_id, order_id, menu_item_id),
    INDEX idx_review_menu_item (menu_item_id),
    INDEX idx_review_user      (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 9: notifications - Thông báo
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT,
    type         ENUM('ORDER_STATUS','RESERVATION','PAYMENT','CALL_STAFF','SYSTEM') NOT NULL,
    title        VARCHAR(200)    NOT NULL,
    message      TEXT            NOT NULL,
    is_read      BOOLEAN         NOT NULL DEFAULT FALSE,
    reference_id BIGINT,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_notif_user      (user_id),
    INDEX idx_notif_is_read   (user_id, is_read),
    INDEX idx_notif_type      (type)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 10: call_staffs - Gọi nhân viên
-- ============================================================
CREATE TABLE IF NOT EXISTS call_staffs (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_id    BIGINT          NOT NULL,
    is_resolved BOOLEAN         NOT NULL DEFAULT FALSE,
    resolved_at DATETIME,
    note        VARCHAR(500),
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_call_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id),
    INDEX idx_call_table      (table_id),
    INDEX idx_call_resolved   (is_resolved)
) ENGINE=InnoDB;

-- ============================================================
-- BẢNG 11: refresh_tokens - JWT Refresh Token
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT          NOT NULL,
    token      VARCHAR(500)    NOT NULL UNIQUE,
    expires_at DATETIME        NOT NULL,
    is_revoked BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rt_user      (user_id),
    INDEX idx_rt_token     (token),
    INDEX idx_rt_revoked   (is_revoked)
) ENGINE=InnoDB;

-- ============================================================
-- DỮ LIỆU MẪU (Sample Data)
-- ============================================================

-- Admin account (password: Admin@123 - BCrypt hash)
INSERT INTO users (full_name, email, phone, password, role) VALUES
('Admin Hệ Thống',  'admin@restaurant.com',  '0900000001', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'ADMIN'),
('Nhân Viên A',     'staff1@restaurant.com', '0900000002', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'STAFF'),
('Nguyễn Văn An',   'an@gmail.com',          '0912345678', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'CUSTOMER');
-- NOTE: Mật khẩu mẫu = "password" (BCrypt). Đổi trước khi deploy!

-- Bàn ăn
INSERT INTO restaurant_tables (table_number, capacity, location, status, qr_code_token) VALUES
('A01', 2, 'Tầng 1 - Cửa sổ', 'AVAILABLE', UUID()),
('A02', 4, 'Tầng 1 - Giữa',   'AVAILABLE', UUID()),
('A03', 4, 'Tầng 1 - Giữa',   'AVAILABLE', UUID()),
('A04', 6, 'Tầng 1 - Cuối',   'AVAILABLE', UUID()),
('B01', 2, 'Tầng 2 - Ban công','AVAILABLE', UUID()),
('B02', 4, 'Tầng 2 - VIP',    'AVAILABLE', UUID()),
('B03', 8, 'Tầng 2 - Phòng lớn','AVAILABLE', UUID()),
('C01', 10,'Phòng riêng 1',   'AVAILABLE', UUID()),
('C02', 12,'Phòng riêng 2',   'AVAILABLE', UUID());

-- Danh mục
INSERT INTO categories (name, description, sort_order) VALUES
('Khai Vị',          'Các món ăn nhẹ để khai vị',               1),
('Món Chính',        'Các món ăn chính đặc trưng',               2),
('Lẩu & Nướng',      'Các loại lẩu và đồ nướng',                 3),
('Cơm & Mì',         'Các món cơm, bún, phở, mì',                4),
('Tráng Miệng',      'Các món ngọt và tráng miệng',              5),
('Đồ Uống',          'Nước giải khát, sinh tố, trà, cà phê',     6);

-- Món ăn mẫu
INSERT INTO menu_items (category_id, name, description, price, is_available) VALUES
-- Khai vị (id=1)
(1, 'Gỏi Cuốn Tôm Thịt',   'Gỏi cuốn tươi với tôm, thịt, rau thơm, chấm tương hoisin', 45000, TRUE),
(1, 'Chả Giò Chiên Giòn',   'Chả giò nhân thịt cua, chiên giòn vàng đều',               50000, TRUE),
(1, 'Súp Cua',               'Súp cua nấu sốt cà chua béo ngậy',                         55000, TRUE),

-- Món chính (id=2)
(2, 'Cá Hồi Sốt Cam',        'Cá hồi áp chảo sốt cam tươi, ăn kèm rau củ nướng',        185000, TRUE),
(2, 'Bò Lúc Lắc',            'Bò phi lê xào lúc lắc, ăn kèm cơm chiên trứng',            165000, TRUE),
(2, 'Gà Nướng Mật Ong',      'Gà ta nướng mật ong sả ớt, da giòn thịt ngọt',             145000, TRUE),

-- Lẩu & Nướng (id=3)
(3, 'Lẩu Thái Hải Sản',      'Lẩu thái chua cay với hải sản tươi (2 người)',              280000, TRUE),
(3, 'Lẩu Bò Nhúng Dấm',     'Lẩu giấm với bò Mỹ nhúng, rau sống đặc biệt',             260000, TRUE),
(3, 'Combo Nướng BBQ',       'Combo thịt nướng: bò, heo, gà, rau củ (3 người)',          350000, TRUE),

-- Cơm & Mì (id=4)
(4, 'Cơm Tấm Sườn Bì Chả',  'Cơm tấm với sườn nướng, bì, chả trứng, nước mắm pha',     65000, TRUE),
(4, 'Phở Bò Tái Nạm',        'Phở bò truyền thống, nước dùng hầm 12 tiếng',             75000, TRUE),
(4, 'Bún Bò Huế',             'Bún bò Huế chuẩn vị, sả, mắm ruốc đặc trưng',            70000, TRUE),

-- Tráng miệng (id=5)
(5, 'Chè Ba Màu',             'Chè ba màu đặc sắc truyền thống Nam Bộ',                   35000, TRUE),
(5, 'Bánh Flan Caramen',      'Bánh flan mềm mịn, caramen đắng nhẹ',                      40000, TRUE),
(5, 'Kem Dừa Nha Đam',        'Kem dừa tươi với thạch nha đam thanh mát',                 45000, TRUE),

-- Đồ uống (id=6)
(6, 'Nước Ép Cam Tươi',       'Cam tươi ép nguyên chất, không đường',                     35000, TRUE),
(6, 'Sinh Tố Xoài',           'Xoài cát Hòa Lộc blended với sữa tươi',                   40000, TRUE),
(6, 'Trà Đào Cam Sả',         'Trà đào thơm ngon pha cam và sả tươi',                     35000, TRUE),
(6, 'Cà Phê Sữa Đá',          'Cà phê robusta pha phin truyền thống',                     30000, TRUE),
(6, 'Bia Tiger (330ml)',       'Bia Tiger lon lạnh',                                        25000, TRUE);


-- ============================================================
-- VIEWS (Hỗ trợ báo cáo nhanh)
-- ============================================================

-- View: Trạng thái bàn hiện tại
CREATE OR REPLACE VIEW v_table_status AS
SELECT
    rt.id,
    rt.table_number,
    rt.capacity,
    rt.location,
    rt.status,
    rt.qr_code_url,
    COUNT(CASE WHEN o.status NOT IN ('COMPLETED','CANCELLED') THEN o.id END) AS active_orders
FROM restaurant_tables rt
LEFT JOIN orders o ON rt.id = o.table_id
WHERE rt.is_active = TRUE
GROUP BY rt.id;

-- View: Doanh thu hôm nay
CREATE OR REPLACE VIEW v_today_revenue AS
SELECT
    COALESCE(SUM(total_amount), 0) AS today_revenue,
    COUNT(*)                       AS total_orders,
    COUNT(CASE WHEN payment_method = 'QR_CODE' THEN id END) AS qr_payments,
    COUNT(CASE WHEN payment_method = 'CASH' THEN id END)    AS cash_payments
FROM orders
WHERE payment_status = 'PAID'
  AND DATE(paid_at) = CURDATE();

-- View: Top 10 món bán chạy
CREATE OR REPLACE VIEW v_top_menu_items AS
SELECT
    mi.id,
    mi.name,
    c.name AS category,
    mi.price,
    mi.total_sold,
    mi.avg_rating,
    COALESCE(SUM(oi.quantity), 0) AS total_quantity
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
WHERE mi.is_active = TRUE
GROUP BY mi.id
ORDER BY mi.total_sold DESC
LIMIT 10;

-- Thiết kế tham chiếu / bản nháp. Schema chạy thật cho backend: Flyway trong
-- restaurant-backend1/src/main/resources/db/migration/ (V1.0.1 …) — đồng bộ với JPA hiện tại.
-- Restaurant DB schema (MySQL 8.0+ recommended for CHECK constraints)
-- Charset: utf8mb4 for Vietnamese + emoji-safe text

SET NAMES utf8mb4;

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255),

    role VARCHAR(20) NOT NULL,

    avatar_url VARCHAR(500),
    is_active TINYINT(1) NOT NULL,

    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(200),

    CONSTRAINT uq_oauth UNIQUE (oauth_provider, oauth_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- RESTAURANT TABLES
-- =========================
CREATE TABLE restaurant_tables (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    table_number VARCHAR(20) NOT NULL UNIQUE,
    capacity INT NOT NULL,
    location VARCHAR(100),

    status VARCHAR(50) NOT NULL,

    qr_code_url VARCHAR(500),
    qr_code_token VARCHAR(200) UNIQUE,

    is_active TINYINT(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- CATEGORIES
-- =========================
CREATE TABLE categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    name VARCHAR(255),
    description TEXT,
    image_url VARCHAR(255),
    sort_order INT,

    is_active TINYINT(1),
    is_deleted TINYINT(1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- MENU ITEMS
-- =========================
CREATE TABLE menu_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    category_id BIGINT,

    name VARCHAR(255),
    description TEXT,
    price DECIMAL(12, 0),

    image_url VARCHAR(255),

    is_available TINYINT(1),
    is_active TINYINT(1),
    is_deleted TINYINT(1),

    total_sold INT,
    avg_rating DECIMAL(3, 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- RESERVATIONS
-- =========================
CREATE TABLE reservations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    user_id BIGINT,
    table_id BIGINT,

    reservation_time DATETIME,
    number_of_guests INT,

    customer_name VARCHAR(255),
    customer_phone VARCHAR(30),
    note VARCHAR(255),

    status VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- ORDERS
-- =========================
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    table_id BIGINT,
    user_id BIGINT,
    reservation_id BIGINT,

    customer_type VARCHAR(50),
    guest_name VARCHAR(255),

    status VARCHAR(50) NOT NULL,

    total_amount DECIMAL(12, 0),
    note VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- ORDER ITEMS
-- =========================
CREATE TABLE order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    order_id BIGINT NOT NULL,
    menu_item_id BIGINT NOT NULL,

    quantity INT NOT NULL,
    unit_price DECIMAL(12, 0),
    subtotal DECIMAL(12, 0),

    note VARCHAR(255),
    status VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- PAYMENTS
-- =========================
CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    order_id BIGINT NOT NULL,
    amount DECIMAL(12, 0) NOT NULL,

    method VARCHAR(50),
    status VARCHAR(50),

    paid_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- REVIEWS (per dish in an order)
-- =========================
CREATE TABLE reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    user_id BIGINT NOT NULL,
    menu_item_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,

    rating INT NOT NULL,
    comment TEXT,

    status VARCHAR(50) NOT NULL,

    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT uq_review_user_order_item UNIQUE (user_id, order_id, menu_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    user_id BIGINT,

    type VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,

    is_read TINYINT(1) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- CALL STAFF
-- =========================
CREATE TABLE call_staffs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    created_at DATETIME,
    updated_at DATETIME,
    created_by BIGINT,
    updated_by BIGINT,

    table_id BIGINT,
    status VARCHAR(50),

    handled_by BIGINT,
    handled_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- FOREIGN KEYS — business relations
-- =========================
ALTER TABLE menu_items
    ADD CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES categories (id);

ALTER TABLE reservations
    ADD CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users (id),
    ADD CONSTRAINT fk_reservations_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id);

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id),
    ADD CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id),
    ADD CONSTRAINT fk_orders_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (id);

ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id),
    ADD CONSTRAINT fk_order_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items (id);

ALTER TABLE payments
    ADD CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id);

ALTER TABLE reviews
    ADD CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id),
    ADD CONSTRAINT fk_reviews_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items (id),
    ADD CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders (id);

ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE call_staffs
    ADD CONSTRAINT fk_call_staffs_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id),
    ADD CONSTRAINT fk_call_staffs_handled_by FOREIGN KEY (handled_by) REFERENCES users (id);

-- =========================
-- FOREIGN KEYS — audit (created_by / updated_by)
-- =========================
ALTER TABLE users
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE restaurant_tables
    ADD CONSTRAINT fk_restaurant_tables_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_restaurant_tables_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE categories
    ADD CONSTRAINT fk_categories_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE menu_items
    ADD CONSTRAINT fk_menu_items_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_menu_items_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE reservations
    ADD CONSTRAINT fk_reservations_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_reservations_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_order_items_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE payments
    ADD CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_payments_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE reviews
    ADD CONSTRAINT fk_reviews_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_reviews_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_notifications_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE call_staffs
    ADD CONSTRAINT fk_call_staffs_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_call_staffs_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

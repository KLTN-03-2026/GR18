-- Tai khoan nhan vien demo (role STAFF)
-- Mat khau mac dinh: Admin@123 (BCrypt, cost=10) -> nen doi sau khi dang nhap.
--
-- Luu y: email/phone la UNIQUE. Neu DB da co trung, hay sua gia tri cho phu hop.

INSERT INTO users (full_name, email, phone, password, role, is_active, created_at, updated_at)
VALUES
(
    'Nhan vien 01',
    'staff01@restaurant.com',
    '0900000011',
    '$2a$10$cjYq7ocAAQHfgkDbG7nNgu1sRm0NOwmALcMha8qZVDl/X/TAFcyFG',
    'STAFF',
    1,
    NOW(),
    NOW()
),
(
    'Nhan vien 02',
    'staff02@restaurant.com',
    '0900000012',
    '$2a$10$cjYq7ocAAQHfgkDbG7nNgu1sRm0NOwmALcMha8qZVDl/X/TAFcyFG',
    'STAFF',
    1,
    NOW(),
    NOW()
);


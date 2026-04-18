-- Tai khoan admin bo sung: email superadmin@restaurant.com / mat khau Admin@123
INSERT INTO users (full_name, email, phone, password, role, is_active, created_at, updated_at)
VALUES (
    'Quản trị (Admin@123)',
    'superadmin@restaurant.com',
    '0900000009',
    '$2a$10$cjYq7ocAAQHfgkDbG7nNgu1sRm0NOwmALcMha8qZVDl/X/TAFcyFG',
    'ADMIN',
    1,
    NOW(),
    NOW()
);

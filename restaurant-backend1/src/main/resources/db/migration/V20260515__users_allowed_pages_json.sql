-- Cột quyền trang cho STAFF (đồng bộ entity User.allowedPagesJson)
-- Chạy thủ công nếu Flyway tắt và ddl-auto chưa tạo cột.
ALTER TABLE users ADD COLUMN allowed_pages_json VARCHAR(2000) NULL;

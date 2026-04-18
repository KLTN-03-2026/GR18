-- Bàn demo + token QR cố định (khớp codefe/admin/sodoban.js FALLBACK_TABLES).
-- Khách quét URL: .../index/menu.html?t=<qr_code_token>

INSERT IGNORE INTO restaurant_tables (table_number, capacity, location, status, qr_code_token, is_active)
VALUES
    ('B01', 4, 'Sảnh chính', 'AVAILABLE', 'demo-qr-b01', 1),
    ('B02', 2, 'Cửa sổ', 'AVAILABLE', 'demo-qr-b02', 1),
    ('B03', 6, 'Khu gia đình', 'AVAILABLE', 'demo-qr-b03', 1),
    ('B04', 4, 'Ngoài trời', 'AVAILABLE', 'demo-qr-b04', 1),
    ('B05', 4, 'Tầng 2', 'AVAILABLE', 'demo-qr-b05', 1),
    ('B06', 2, 'Quầy bar', 'AVAILABLE', 'demo-qr-b06', 1);

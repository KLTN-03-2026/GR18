-- Gom món có tên chứa "salad" (không phân biệt hoa thường) vào danh mục "Khai Vị".
UPDATE menu_items mi
JOIN categories c ON c.name = 'Khai Vị' AND c.is_active = TRUE
SET mi.category_id = c.id,
    mi.updated_at  = NOW()
WHERE LOWER(mi.name) LIKE '%salad%';

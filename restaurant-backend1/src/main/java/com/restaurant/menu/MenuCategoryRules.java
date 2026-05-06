package com.restaurant.menu;

import com.restaurant.entity.Category;

import java.util.Locale;

/**
 * Phân loại danh mục menu (đồ uống vs món ăn) — dùng chung cho chatbot và gợi ý AI.
 */
public final class MenuCategoryRules {

    private MenuCategoryRules() {
    }

    public static boolean isBeverageCategory(Category c) {
        if (c == null || c.getName() == null || c.getName().isBlank()) {
            return false;
        }
        String n = c.getName().trim().toLowerCase(Locale.ROOT);
        if (n.contains("đồ uống") || n.contains("nước uống") || n.contains("cà phê") || n.contains("coffee")) {
            return true;
        }
        return n.equals("drinks") || n.equals("beverages") || n.equals("beverage") || n.equals("cafe");
    }
}

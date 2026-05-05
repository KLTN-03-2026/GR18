package com.restaurant.service;

import com.restaurant.controller.MenuController.SearchResponse;
import com.restaurant.dto.response.MenuItemPublicResponse;
import com.restaurant.mapper.MenuResultSetMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final JdbcTemplate jdbcTemplate;
    private final MenuResultSetMapper mapper;

    public List<MenuItemPublicResponse> getMenu() {
        String sql = """
                SELECT m.id, m.name, m.description, m.price, m.image_url, m.avg_rating, c.name AS category_name
                FROM menu_items m
                JOIN categories c ON c.id = m.category_id
                WHERE m.is_active = 1 AND m.is_available = 1 AND c.is_active = 1
                ORDER BY c.sort_order ASC, m.id DESC
                """;
        return jdbcTemplate.query(sql, (rs, i) -> mapper.fromResultSet(rs));
    }

    public MenuItemPublicResponse getMenuDetail(Long id) {
        String sql = """
                SELECT m.id, m.name, m.description, m.price, m.image_url, m.avg_rating, c.name AS category_name
                FROM menu_items m
                JOIN categories c ON c.id = m.category_id
                WHERE m.id = ? AND m.is_active = 1
                LIMIT 1
                """;
        List<MenuItemPublicResponse> rows = jdbcTemplate.query(sql, (rs, i) -> mapper.fromResultSet(rs), id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public SearchResponse<MenuItemPublicResponse> search(String keyword) {
        String kw = "%" + keyword.trim() + "%";
        String sql = """
                SELECT m.id, m.name, m.description, m.price, m.image_url, m.avg_rating, c.name AS category_name
                FROM menu_items m
                JOIN categories c ON c.id = m.category_id
                WHERE m.is_active = 1 AND m.is_available = 1
                  AND (m.name LIKE ? OR m.description LIKE ?)
                ORDER BY m.id DESC
                LIMIT 50
                """;
        List<MenuItemPublicResponse> content = jdbcTemplate.query(sql, (rs, i) -> mapper.fromResultSet(rs), kw, kw);
        return new SearchResponse<>(content);
    }
}

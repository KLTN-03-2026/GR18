package com.restaurant.mapper;

import com.restaurant.dto.response.MenuItemPublicResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.stereotype.Component;

@Component
public class MenuResultSetMapper {

    public MenuItemPublicResponse fromResultSet(ResultSet rs) throws SQLException {
        return MenuItemPublicResponse.builder()
                .id(rs.getLong("id"))
                .name(rs.getString("name"))
                .description(rs.getString("description"))
                .price(rs.getBigDecimal("price"))
                .imageUrl(rs.getString("image_url"))
                .avgRating(rs.getBigDecimal("avg_rating"))
                .categoryName(rs.getString("category_name"))
                .build();
    }
}


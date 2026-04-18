package com.restaurant.mapper;

import com.restaurant.dto.response.menu_items.MenuItemResponse;
import com.restaurant.entity.MenuItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

@Mapper(componentModel = "spring")
public interface MenuItemMapper {

    @Mapping(target = "price", expression = "java(mapPrice(menuItem.getPrice()))")
    @Mapping(target = "formattedPrice", expression = "java(formatPrice(menuItem.getPrice()))")
    @Mapping(target = "image", source = "imageUrl")
    MenuItemResponse toResponse(MenuItem menuItem);

    List<MenuItemResponse> toResponseList(List<MenuItem> items);

    default Double mapPrice(BigDecimal price) {
        return price != null ? price.doubleValue() : 0.0;
    }

    default String formatPrice(BigDecimal price) {
        if (price == null) return "0đ";
        NumberFormat formatter = NumberFormat.getInstance(new Locale("vi", "VN"));
        return formatter.format(price) + "đ";
    }
}
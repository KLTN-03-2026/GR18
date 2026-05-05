package com.restaurant.mapper;

import com.restaurant.dto.response.menu_items.MenuItemPublicResponse;
import com.restaurant.entity.MenuItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

@Mapper(componentModel = "spring")
public interface MenuItemPublicMapper {

    // map 1 item
    @Mapping(target = "formattedPrice", expression = "java(formatPrice(menuItem.getPrice()))")
    @Mapping(target = "image", expression = "java(mapImage(menuItem.getImageUrl()))")
    MenuItemPublicResponse toDTO(MenuItem menuItem);

    // map list
    List<MenuItemPublicResponse> toDTOList(List<MenuItem> items);

    // ================= HELPER =================

    default String formatPrice(BigDecimal price) {
        if (price == null) return "0 VND";
        NumberFormat formatter = NumberFormat.getInstance(new Locale("vi", "VN"));
        return formatter.format(price) + " VND";
    }

    default String mapImage(String imageUrl) {
        return imageUrl != null ? imageUrl : "";
    }
}
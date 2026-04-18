package com.restaurant.dto.response.menu_items;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MenuItemPublicResponse {

    Long id;
    String name;
    Double price;
    String formattedPrice;
    String image;
}
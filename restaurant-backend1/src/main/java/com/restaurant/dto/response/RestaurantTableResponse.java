package com.restaurant.dto.response;

import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.TableStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantTableResponse {

    private Long id;
    private String tableNumber;
    private Integer capacity;
    private String location;
    private TableStatus status;
    private String qrCodeUrl;
    private String qrCodeToken;
    private Boolean isActive;

    public static RestaurantTableResponse from(RestaurantTable entity) {
        if (entity == null) {
            return null;
        }
        return RestaurantTableResponse.builder()
                .id(entity.getId())
                .tableNumber(entity.getTableNumber())
                .capacity(entity.getCapacity())
                .location(entity.getLocation())
                .status(entity.getStatus())
                .qrCodeUrl(entity.getQrCodeUrl())
                .qrCodeToken(entity.getQrCodeToken())
                .isActive(entity.getIsActive())
                .build();
    }
}

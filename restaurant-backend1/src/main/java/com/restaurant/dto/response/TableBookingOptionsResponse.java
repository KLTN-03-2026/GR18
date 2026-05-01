package com.restaurant.dto.response;

import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TableBookingOptionsResponse {

    @Builder.Default
    private List<String> locations = new ArrayList<>();

    @Builder.Default
    private List<RestaurantTableResponse> tables = new ArrayList<>();
}

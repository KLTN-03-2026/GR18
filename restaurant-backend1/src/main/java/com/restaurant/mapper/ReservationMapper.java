package com.restaurant.mapper;

import com.restaurant.dto.request.ReservationRequest;
import com.restaurant.dto.response.ReservationResponse;
import com.restaurant.entity.Reservation;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ReservationMapper {

    // 1. Từ Request sang Entity (Dùng khi Create/Update)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", constant = "PENDING")
    Reservation toEntity(ReservationRequest request);

    // 2. Từ Entity sang Response (Dùng khi trả về API)
    @Mapping(target = "tableId", source = "table.id")
    @Mapping(target = "tableNumber", source = "table.tableNumber")
    ReservationResponse toResponse(Reservation entity);
}
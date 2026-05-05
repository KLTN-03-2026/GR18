package com.restaurant.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
public class AiJsonIds {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Long>> LONG_LIST = new TypeReference<>() {};

    public List<Long> parseLongIds(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            List<Long> list = MAPPER.readValue(json, LONG_LIST);
            return list == null ? Collections.emptyList() : list.stream().filter(id -> id != null && id > 0).toList();
        } catch (Exception e) {
            log.warn("parseLongIds: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public String toJson(List<Long> ids) {
        try {
            return MAPPER.writeValueAsString(ids == null ? new ArrayList<>() : ids);
        } catch (Exception e) {
            return "[]";
        }
    }
}

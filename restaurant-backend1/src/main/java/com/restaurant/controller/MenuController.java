package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.MenuItemPublicResponse;
import com.restaurant.service.MenuService;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/menu")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MenuController {

    private final MenuService menuService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MenuItemPublicResponse>>> getMenu() {
        return ResponseEntity.ok(ApiResponse.success(menuService.getMenu()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MenuItemPublicResponse>> getMenuDetail(@PathVariable Long id) {
        MenuItemPublicResponse item = menuService.getMenuDetail(id);
        if (item == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ApiResponse.success(item));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<SearchResponse<MenuItemPublicResponse>>> search(
            @RequestParam @NotBlank String keyword
    ) {
        return ResponseEntity.ok(ApiResponse.success(menuService.search(keyword)));
    }

    @Data
    @AllArgsConstructor
    public static class SearchResponse<T> {
        private List<T> content;
    }
}

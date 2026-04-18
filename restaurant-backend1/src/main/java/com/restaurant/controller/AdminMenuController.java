package com.restaurant.controller;

import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.menu_items.AdminMenuItemResponse;
import com.restaurant.entity.Category;
import com.restaurant.entity.MenuItem;
import com.restaurant.repository.CategoryRepository;
import com.restaurant.repository.MenuItemRepository;
import com.restaurant.service.CloudinaryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin - Menu", description = "Admin quản lý danh mục và món ăn (US21)")
public class AdminMenuController {

    private final CategoryRepository categoryRepository;
    private final MenuItemRepository menuItemRepository;
    private final CloudinaryService cloudinaryService;

    // ===== CATEGORY CRUD =====

    @GetMapping("/categories")
    @Operation(summary = "Lấy tất cả danh mục (kể cả ẩn)")
    public ResponseEntity<ApiResponse<List<Category>>> getAllCategories() {
        return ResponseEntity.ok(ApiResponse.success(categoryRepository.findAll()));
    }

    @PostMapping("/categories")
    @Operation(summary = "Tạo danh mục mới")
    public ResponseEntity<ApiResponse<Category>> createCategory(@Valid @RequestBody CategoryRequest request) {
        if (categoryRepository.existsByName(request.getName())) {
            throw new IllegalArgumentException("Tên danh mục đã tồn tại");
        }
        Category category = new Category();
        category.setName(request.getName());
        category.setDescription(request.getDescription());
        category.setImageUrl(request.getImageUrl());
        category.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);
        category.setIsActive(true);
        return ResponseEntity.ok(ApiResponse.success(categoryRepository.save(category), "Tạo danh mục thành công"));
    }

    @PutMapping("/categories/{id}")
    @Operation(summary = "Cập nhật danh mục")
    public ResponseEntity<ApiResponse<Category>> updateCategory(
            @PathVariable Long id,
            @Valid @RequestBody CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Danh mục không tồn tại"));
        category.setName(request.getName());
        category.setDescription(request.getDescription());
        category.setImageUrl(request.getImageUrl());
        if (request.getSortOrder() != null) category.setSortOrder(request.getSortOrder());
        return ResponseEntity.ok(ApiResponse.success(categoryRepository.save(category), "Cập nhật thành công"));
    }

    @DeleteMapping("/categories/{id}")
    @Operation(summary = "Xóa danh mục (chỉ khi không còn món)")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Danh mục không tồn tại"));
        List<MenuItem> items = menuItemRepository.findByCategoryIdAndIsActiveTrue(id);
        if (!items.isEmpty()) {
            throw new IllegalStateException("Không thể xóa danh mục vì vẫn còn " + items.size() + " món ăn");
        }
        category.setIsActive(false);
        categoryRepository.save(category);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa danh mục"));
    }

    // ===== MENU ITEM CRUD =====

    @GetMapping("/menu-items")
    public ResponseEntity<ApiResponse<List<AdminMenuItemResponse>>> getAllMenuItems(
            @RequestParam(required = false) Long categoryId) {

        List<MenuItem> items = categoryId != null
                ? menuItemRepository.findByCategoryIdWithCategory(categoryId)
                : menuItemRepository.findAllWithCategory();

        List<AdminMenuItemResponse> result = items.stream().map(item ->
                AdminMenuItemResponse.builder()
                        .id(item.getId())
                        .name(item.getName())
                        .description(item.getDescription())
                        .price(item.getPrice())
                        .imageUrl(item.getImageUrl())
                        .isAvailable(item.getIsAvailable())
                        .isActive(item.getIsActive())
                        .categoryName(item.getCategory().getName())
                        .totalSold(item.getTotalSold())
                        .avgRating(item.getAvgRating() != null
                                ? item.getAvgRating().doubleValue()
                                : 0.0)
                        .build()
        ).toList();

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/menu-items")
    @Operation(summary = "Thêm món ăn mới")
    public ResponseEntity<ApiResponse<AdminMenuItemResponse>> createMenuItem(@Valid @RequestBody MenuItemRequest request) {
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("Danh mục không tồn tại"));
        MenuItem item = new MenuItem();
        item.setCategory(category);
        item.setName(request.getName());
        item.setDescription(request.getDescription());
        item.setPrice(request.getPrice());
        item.setImageUrl(request.getImageUrl());
        item.setIsAvailable(true);
        item.setIsActive(true);
        item.setTotalSold(0);
        item.setAvgRating(BigDecimal.valueOf(0.0));
        MenuItem saved = menuItemRepository.save(item);
        return ResponseEntity.ok(ApiResponse.success(toAdminMenuItemResponse(saved), "Thêm món ăn thành công"));
    }

    @PostMapping(value = "/menu-items/upload-image", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload ảnh món ăn lên Cloudinary")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadMenuImage(
            @RequestPart("file") MultipartFile file) {
        Map<String, String> uploaded = cloudinaryService.uploadMenuImage(file);
        return ResponseEntity.ok(ApiResponse.success(uploaded, "Upload ảnh thành công"));
    }

    @PutMapping("/menu-items/{id}")
    @Operation(summary = "Cập nhật món ăn")
    public ResponseEntity<ApiResponse<AdminMenuItemResponse>> updateMenuItem(
            @PathVariable Long id,
            @Valid @RequestBody MenuItemRequest request) {
        MenuItem item = menuItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Danh mục không tồn tại"));
            item.setCategory(category);
        }
        if (request.getName() != null) item.setName(request.getName());
        if (request.getDescription() != null) item.setDescription(request.getDescription());
        if (request.getPrice() != null) item.setPrice(request.getPrice());
        if (request.getImageUrl() != null) item.setImageUrl(request.getImageUrl());
        MenuItem saved = menuItemRepository.save(item);
        return ResponseEntity.ok(ApiResponse.success(toAdminMenuItemResponse(saved), "Cập nhật món ăn thành công"));
    }

    @PatchMapping("/menu-items/{id}/availability")
    @Operation(summary = "Bật/tắt trạng thái có sẵn của món (hết nguyên liệu,...)")
    public ResponseEntity<ApiResponse<AdminMenuItemResponse>> toggleAvailability(
            @PathVariable Long id,
            @RequestParam Boolean isAvailable) {
        MenuItem item = menuItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));
        item.setIsAvailable(isAvailable);
        MenuItem saved = menuItemRepository.save(item);
        return ResponseEntity.ok(ApiResponse.success(toAdminMenuItemResponse(saved),
                isAvailable ? "Món đã được bật" : "Món đã bị tắt"));
    }

    @DeleteMapping("/menu-items/{id}")
    @Operation(summary = "Xóa món ăn (soft delete)")
    public ResponseEntity<ApiResponse<Void>> deleteMenuItem(@PathVariable Long id) {
        MenuItem item = menuItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Món ăn không tồn tại"));

        // 1. Chuyển trạng thái hoạt động về false (ẩn khỏi Menu khách hàng)
        item.setIsActive(false);

        // 2. Chuyển trạng thái có sẵn về false (không cho phép đặt món)
        item.setIsAvailable(false);

        menuItemRepository.save(item);

        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa món ăn thành công"));
    }

    // ===== Inner DTO classes =====

    @Data
    public static class CategoryRequest {
        @NotBlank(message = "Tên danh mục không được để trống")
        private String name;
        private String description;
        private String imageUrl;
        private Integer sortOrder;
    }

    @Data
    public static class MenuItemRequest {
        private Long categoryId;

        @NotBlank(message = "Tên món không được để trống")
        private String name;

        private String description;

        @NotNull(message = "Giá không được để trống")
        @DecimalMin(value = "0", message = "Giá phải lớn hơn 0")
        private BigDecimal price;

        private String imageUrl;
    }

    private AdminMenuItemResponse toAdminMenuItemResponse(MenuItem item) {
        Category category = null;
        if (item.getCategory() != null && item.getCategory().getId() != null) {
            category = categoryRepository.findById(item.getCategory().getId()).orElse(null);
        }

        return AdminMenuItemResponse.builder()
                .id(item.getId())
                .name(item.getName())
                .description(item.getDescription())
                .price(item.getPrice())
                .imageUrl(item.getImageUrl())
                .isAvailable(item.getIsAvailable())
                .isActive(item.getIsActive())
                .categoryName(category != null ? category.getName() : null)
                .totalSold(item.getTotalSold())
                .avgRating(item.getAvgRating() != null ? item.getAvgRating().doubleValue() : 0.0)
                .build();
    }
}

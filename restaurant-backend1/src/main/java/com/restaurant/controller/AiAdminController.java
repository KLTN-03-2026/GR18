package com.restaurant.controller;

import com.restaurant.dto.request.admin.AiAdminConfigUpdateRequest;
import com.restaurant.dto.response.ApiResponse;
import com.restaurant.dto.response.admin.AiAdminConfigResponse;
import com.restaurant.dto.response.admin.AiAdminStatsResponse;
import com.restaurant.dto.response.admin.AiSuggestionLogRowResponse;
import com.restaurant.service.AiAdminPanelService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/ai")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
public class AiAdminController {

    private final AiAdminPanelService aiAdminPanelService;

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<AiAdminConfigResponse>> getConfig() {
        return ResponseEntity.ok(ApiResponse.success(aiAdminPanelService.getConfig()));
    }

    @PutMapping("/config")
    public ResponseEntity<ApiResponse<AiAdminConfigResponse>> updateConfig(
            @Valid @RequestBody AiAdminConfigUpdateRequest body) {
        return ResponseEntity.ok(ApiResponse.success(aiAdminPanelService.updateConfig(body), "Đã lưu cấu hình AI"));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AiAdminStatsResponse>> stats() {
        return ResponseEntity.ok(ApiResponse.success(aiAdminPanelService.stats()));
    }

    @GetMapping("/suggestions/recent")
    public ResponseEntity<ApiResponse<List<AiSuggestionLogRowResponse>>> recent() {
        return ResponseEntity.ok(ApiResponse.success(aiAdminPanelService.recentLogs()));
    }
}

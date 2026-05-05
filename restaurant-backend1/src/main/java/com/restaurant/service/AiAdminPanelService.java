package com.restaurant.service;

import com.restaurant.ai.AiJsonIds;
import com.restaurant.dto.request.admin.AiAdminConfigUpdateRequest;
import com.restaurant.dto.response.admin.AiAdminConfigResponse;
import com.restaurant.dto.response.admin.AiAdminStatsResponse;
import com.restaurant.dto.response.admin.AiSuggestionLogRowResponse;
import com.restaurant.entity.AiSuggestionLog;
import com.restaurant.entity.AiSystemConfig;
import com.restaurant.repository.AiSuggestionLogRepository;
import com.restaurant.repository.AiSystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiAdminPanelService {

    private final AiSystemConfigRepository configRepository;
    private final AiSuggestionLogRepository logRepository;
    private final AiJsonIds aiJsonIds;

    @Value("${google.gemini.api.key:}")
    private String geminiApiKey;

    @Transactional(readOnly = true)
    public AiAdminConfigResponse getConfig() {
        AiSystemConfig c = configRepository.findById(AiSystemConfig.SINGLETON_ID).orElseThrow();
        return toResponse(c, StringUtils.hasText(geminiApiKey));
    }

    @Transactional
    public AiAdminConfigResponse updateConfig(AiAdminConfigUpdateRequest req) {
        AiSystemConfig c = configRepository.findById(AiSystemConfig.SINGLETON_ID).orElseThrow();
        if (req.getAiEnabled() != null) {
            c.setAiEnabled(req.getAiEnabled());
        }
        if (req.getGeminiEnabled() != null) {
            c.setGeminiEnabled(req.getGeminiEnabled());
        }
        if (req.getPinnedMenuItemIdsJson() != null) {
            c.setPinnedMenuItemIdsJson(req.getPinnedMenuItemIdsJson().trim());
        }
        if (req.getRestrictCategoryIdsJson() != null) {
            c.setRestrictCategoryIdsJson(req.getRestrictCategoryIdsJson().trim());
        }
        if (req.getHistoryLookbackDays() != null) {
            c.setHistoryLookbackDays(req.getHistoryLookbackDays());
        }
        if (req.getRatingWeight() != null && req.getSalesWeight() != null) {
            c.setRatingWeight(req.getRatingWeight());
            c.setSalesWeight(req.getSalesWeight());
        } else if (req.getRatingWeight() != null) {
            c.setRatingWeight(req.getRatingWeight());
        } else if (req.getSalesWeight() != null) {
            c.setSalesWeight(req.getSalesWeight());
        }
        if (req.getGeminiTimeoutMs() != null) {
            c.setGeminiTimeoutMs(req.getGeminiTimeoutMs());
        }
        if (req.getAnonymizeAnalytics() != null) {
            c.setAnonymizeAnalytics(req.getAnonymizeAnalytics());
        }
        double rw = c.getRatingWeight() != null ? c.getRatingWeight() : 0.65;
        double sw = c.getSalesWeight() != null ? c.getSalesWeight() : 0.35;
        if (rw + sw <= 0) {
            c.setRatingWeight(0.65);
            c.setSalesWeight(0.35);
        }
        return toResponse(configRepository.save(c), StringUtils.hasText(geminiApiKey));
    }

    @Transactional(readOnly = true)
    public AiAdminStatsResponse stats() {
        long total = logRepository.count();
        long acc = logRepository.countByAcceptedMenuItemIdIsNotNull();
        double rate = total == 0 ? 0 : (double) acc / total;
        Map<String, Long> bySource = new HashMap<>();
        for (Object[] row : logRepository.countGroupedBySource()) {
            if (row[0] != null && row[1] != null) {
                bySource.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
            }
        }
        return AiAdminStatsResponse.builder()
                .totalSuggestions(total)
                .totalAccepted(acc)
                .acceptanceRate(Math.round(rate * 10000) / 10000.0)
                .suggestionsBySource(bySource)
                .build();
    }

    @Transactional(readOnly = true)
    public List<AiSuggestionLogRowResponse> recentLogs() {
        return logRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .map(this::toRow)
                .collect(Collectors.toList());
    }

    private AiSuggestionLogRowResponse toRow(AiSuggestionLog l) {
        int n = aiJsonIds.parseLongIds(l.getSuggestedItemIdsJson()).size();
        return AiSuggestionLogRowResponse.builder()
                .id(l.getId())
                .createdAt(l.getCreatedAt())
                .source(l.getSource() != null ? l.getSource().name() : "")
                .suggestedCount(n)
                .acceptedMenuItemId(l.getAcceptedMenuItemId())
                .acceptedAt(l.getAcceptedAt())
                .replyPreview(l.getReplyPreview())
                .build();
    }

    private AiAdminConfigResponse toResponse(AiSystemConfig c, boolean keyOk) {
        return AiAdminConfigResponse.builder()
                .aiEnabled(c.getAiEnabled())
                .geminiEnabled(c.getGeminiEnabled())
                .pinnedMenuItemIdsJson(c.getPinnedMenuItemIdsJson())
                .restrictCategoryIdsJson(c.getRestrictCategoryIdsJson())
                .historyLookbackDays(c.getHistoryLookbackDays())
                .ratingWeight(c.getRatingWeight())
                .salesWeight(c.getSalesWeight())
                .geminiTimeoutMs(c.getGeminiTimeoutMs())
                .anonymizeAnalytics(c.getAnonymizeAnalytics())
                .geminiKeyConfigured(keyOk)
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}

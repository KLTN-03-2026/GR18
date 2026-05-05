package com.restaurant.service;

import com.restaurant.ai.AiJsonIds;
import com.restaurant.entity.AiSuggestionLog;
import com.restaurant.entity.enums.AiSuggestionSource;
import com.restaurant.repository.AiSuggestionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AiSuggestionLogService {

    private final AiSuggestionLogRepository repository;
    private final AiJsonIds aiJsonIds;

    @Transactional
    public Long logSuggestion(String sessionId, AiSuggestionSource source, List<Long> itemIds, String replyPreview) {
        String hash = sha256Hex(sessionId == null ? "" : sessionId);
        String json = aiJsonIds.toJson(itemIds);
        String preview = replyPreview == null ? "" : replyPreview;
        if (preview.length() > 500) {
            preview = preview.substring(0, 500);
        }
        AiSuggestionLog e = AiSuggestionLog.builder()
                .sessionHash(hash)
                .source(source)
                .suggestedItemIdsJson(json)
                .replyPreview(preview.isBlank() ? null : preview)
                .build();
        return repository.save(e).getId();
    }

    @Transactional
    public void markAccepted(long logId, long menuItemId) {
        AiSuggestionLog log = repository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lượt gợi ý"));
        List<Long> allowed = aiJsonIds.parseLongIds(log.getSuggestedItemIdsJson());
        if (!allowed.contains(menuItemId)) {
            throw new IllegalArgumentException("Món không thuộc danh sách gợi ý của lượt này");
        }
        log.setAcceptedMenuItemId(menuItemId);
        log.setAcceptedAt(Instant.now());
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (Exception e) {
            return "0";
        }
    }
}

package com.restaurant.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.restaurant.entity.MenuItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Gọi Gemini (nếu có API key), timeout ngắn; chỉ được trả id trong tập món từ DB.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiMenuSuggestionService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${google.gemini.api.key:}")
    private String apiKey;

    @Value("${google.gemini.url}")
    private String geminiUrl;

    public List<Long> suggestOrderedIds(String userMessage, List<MenuItem> candidates, int timeoutMs) {
        if (!StringUtils.hasText(apiKey) || candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        int t = Math.clamp(timeoutMs, 800, 5000);
        try {
            String prompt = buildPrompt(userMessage, candidates);
            ObjectNode root = MAPPER.createObjectNode();
            var contents = root.putArray("contents");
            var c = contents.addObject();
            var parts = c.putArray("parts");
            parts.addObject().put("text", prompt);
            String body = MAPPER.writeValueAsString(root);

            URI uri = URI.create(geminiUrl + (geminiUrl.contains("?") ? "&" : "?") + "key=" + apiKey);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(t))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofMillis(t))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> res = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                log.warn("Gemini HTTP {}: {}", res.statusCode(), res.body() != null ? res.body().substring(0, Math.min(200, res.body().length())) : "");
                return List.of();
            }
            String text = extractTextFromGemini(res.body());
            if (!StringUtils.hasText(text)) {
                return List.of();
            }
            return parseIdsFromModelText(text, candidates);
        } catch (Exception e) {
            log.warn("Gemini gọi lỗi hoặc timeout: {}", e.getMessage());
            return List.of();
        }
    }

    private String buildPrompt(String userMessage, List<MenuItem> candidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bạn là trợ lý nhà hàng. Chỉ trả về một JSON object duy nhất dạng {\"ids\":[...]} ")
                .append("gồm tối đa 5 số id món phù hợp với ý khách (tiếng Việt). ")
                .append("Tuyệt đối không thêm id ngoài danh sách.\n")
                .append("Không giải thích, không markdown, không text ngoài JSON.\n")
                .append("Tin nhắn khách: ").append(userMessage == null ? "" : userMessage).append("\n")
                .append("Danh sách món hợp lệ:\n");
        for (MenuItem m : candidates) {
            String name = m.getName() == null ? "" : m.getName().replace('\n', ' ');
            String desc = m.getDescription() == null ? "" : m.getDescription().replace('\n', ' ');
            if (desc.length() > 160) {
                desc = desc.substring(0, 157).trim() + "...";
            }
            String cat = "";
            try {
                if (m.getCategory() != null && m.getCategory().getName() != null) {
                    cat = m.getCategory().getName().replace('\n', ' ');
                }
            } catch (Exception ignored) {
                // Lazy / null
            }
            sb.append("- id:").append(m.getId())
                    .append(" name:").append(name)
                    .append(" cat:").append(cat)
                    .append(" desc:").append(desc)
                    .append("\n");
        }
        return sb.toString();
    }

    private String extractTextFromGemini(String jsonBody) {
        try {
            JsonNode root = MAPPER.readTree(jsonBody);
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) {
                return "";
            }
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (!parts.isArray() || parts.isEmpty()) {
                return "";
            }
            return parts.get(0).path("text").asText("");
        } catch (Exception e) {
            return "";
        }
    }

    List<Long> parseIdsFromModelText(String text, List<MenuItem> candidates) {
        Set<Long> allowed = candidates.stream().map(MenuItem::getId).collect(Collectors.toSet());
        String clean = text.trim();
        if (clean.startsWith("```")) {
            int start = clean.indexOf('{');
            int end = clean.lastIndexOf('}');
            if (start >= 0 && end > start) {
                clean = clean.substring(start, end + 1);
            }
        }
        try {
            JsonNode node = MAPPER.readTree(clean);
            JsonNode ids = node.get("ids");
            if (ids == null || !ids.isArray()) {
                return List.of();
            }
            List<Long> out = new ArrayList<>();
            for (JsonNode idNode : ids) {
                if (idNode.isIntegralNumber()) {
                    long id = idNode.longValue();
                    if (allowed.contains(id) && !out.contains(id)) {
                        out.add(id);
                    }
                }
            }
            return out.stream().limit(5).toList();
        } catch (Exception e) {
            log.debug("Không parse JSON từ Gemini: {}", e.getMessage());
            return List.of();
        }
    }
}

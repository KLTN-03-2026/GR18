package com.restaurant.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
public class CloudinaryService {

    private final RestTemplate restTemplate;

    @Value("${app.cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${app.cloudinary.api-key:}")
    private String apiKey;

    @Value("${app.cloudinary.api-secret:}")
    private String apiSecret;

    @Value("${app.cloudinary.folder:image_dish}")
    private String folder;

    public CloudinaryService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, String> uploadMenuImage(MultipartFile file) {
        validateConfig();
        validateFile(file);

        long timestamp = System.currentTimeMillis() / 1000L;
        String signatureBase = "folder=" + folder + "&timestamp=" + timestamp;
        String signature = sha1Hex(signatureBase + apiSecret);

        String endpoint = "https://api.cloudinary.com/v1_1/" + cloudName + "/image/upload";

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", toResource(file));
        body.add("api_key", apiKey);
        body.add("timestamp", String.valueOf(timestamp));
        body.add("folder", folder);
        body.add("signature", signature);

        MultiValueMap<String, String> headers = new LinkedMultiValueMap<>();
        headers.add("Content-Type", MediaType.MULTIPART_FORM_DATA_VALUE);

        ResponseEntity<Map> response = restTemplate.postForEntity(
                endpoint,
                new HttpEntity<>(body, headers),
                Map.class
        );

        Map payload = response.getBody();
        if (payload == null) {
            throw new IllegalStateException("Cloudinary khong tra ve du lieu.");
        }

        Object secureUrl = payload.get("secure_url");
        if (secureUrl == null || secureUrl.toString().isBlank()) {
            throw new IllegalStateException("Upload thanh cong nhung khong co secure_url.");
        }

        Map<String, String> result = new LinkedHashMap<>();
        result.put("imageUrl", secureUrl.toString());
        Object publicId = payload.get("public_id");
        result.put("publicId", publicId == null ? "" : publicId.toString());
        return result;
    }

    private void validateConfig() {
        if (isBlank(cloudName) || isBlank(apiKey) || isBlank(apiSecret)) {
            throw new IllegalStateException("Thieu cau hinh Cloudinary. Hay set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File anh khong duoc de trong.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new IllegalArgumentException("Chi chap nhan file anh.");
        }
    }

    private ByteArrayResource toResource(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "upload_image");
            return new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };
        } catch (Exception e) {
            throw new IllegalStateException("Khong doc duoc file upload: " + e.getMessage(), e);
        }
    }

    private String sha1Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Khong tao duoc signature Cloudinary.", e);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

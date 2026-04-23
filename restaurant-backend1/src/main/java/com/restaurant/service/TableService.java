package com.restaurant.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.restaurant.dto.response.RestaurantTableResponse;
import com.restaurant.entity.RestaurantTable;
import com.restaurant.entity.enums.TableStatus;
import com.restaurant.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TableService {

    private final RestaurantTableRepository tableRepository;

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${server.port:8080}")
    private String serverPort;

    public RestaurantTable createTable(String tableNumber, Integer capacity, String location) {
        if (tableRepository.findByTableNumber(tableNumber).isPresent()) {
            throw new IllegalArgumentException("Số bàn đã tồn tại: " + tableNumber);
        }
        RestaurantTable table = RestaurantTable.builder()
                .tableNumber(tableNumber)
                .capacity(capacity)
                .location(location)
                .status(TableStatus.AVAILABLE)
                .build();
        table = tableRepository.save(table);
        generateQrCode(table);
        return tableRepository.save(table);
    }

    public byte[] generateQrCode(RestaurantTable table) {
        try {
            String token = UUID.randomUUID().toString();
            table.setQrCodeToken(token);

            String qrContent = "http://localhost:" + serverPort + "/api/tables/qr/" + token;

            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(qrContent, BarcodeFormat.QR_CODE, 300, 300);

            // Lưu file QR vào server
            Path qrDir = Paths.get(uploadDir, "qr");
            Files.createDirectories(qrDir);
            Path filePath = qrDir.resolve("table_" + table.getTableNumber() + ".png");
            MatrixToImageWriter.writeToPath(bitMatrix, "PNG", filePath);

            String qrUrl = "/uploads/qr/table_" + table.getTableNumber() + ".png";
            table.setQrCodeUrl(qrUrl);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tạo mã QR: " + e.getMessage(), e);
        }
    }

    public RestaurantTable getTableByQrToken(String token) {
        return tableRepository.findByQrCodeToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Mã QR không hợp lệ"));
    }

    public Map<String, Object> buildQrScanWelcomeData(String token) {
        RestaurantTable table = getTableByQrToken(token);
        return Map.of(
                "tableId", table.getId(),
                "tableNumber", table.getTableNumber(),
                "capacity", table.getCapacity(),
                "location", table.getLocation() != null ? table.getLocation() : ""
        );
    }

    public List<RestaurantTableResponse> getAllTableResponses() {
        return getAllTables().stream().map(RestaurantTableResponse::from).toList();
    }

    // R5: Lấy bàn theo id (kể cả bàn đã deactivate) — dùng cho Admin
    public RestaurantTable getTableById(Long id) {
        return tableRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Bàn không tồn tại"));
    }

    public List<RestaurantTable> getAllTables() {
        return tableRepository.findByIsActiveTrue();
    }

    public List<RestaurantTable> getAvailableTables() {
        return tableRepository.findByStatus(TableStatus.AVAILABLE);
    }

    public RestaurantTable updateTableStatus(Long tableId, TableStatus status) {
        RestaurantTable table = tableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Bàn không tồn tại"));
        table.setStatus(status);
        return tableRepository.save(table);
    }

    // B5 (US22): Cập nhật thông tin bàn (capacity, location)
    public RestaurantTable updateTableInfo(Long tableId, Integer capacity, String location) {
        RestaurantTable table = tableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Bàn không tồn tại"));
        if (capacity != null && capacity > 0) {
            table.setCapacity(capacity);
        }
        if (location != null && !location.isBlank()) {
            table.setLocation(location);
        }
        return tableRepository.save(table);
    }

    // B5 (US22): Soft-delete bàn (isActive = false)
    public void deleteTable(Long tableId) {
        RestaurantTable table = tableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Bàn không tồn tại"));
        // Không cho xóa nếu đang OCCUPIED hoặc có active orders
        if (TableStatus.OCCUPIED.equals(table.getStatus())) {
            throw new IllegalStateException("Không thể xóa bàn đang có khách");
        }
        table.setIsActive(false);
        tableRepository.save(table);
    }

    // B5 (US22): Tạo lại mã QR mới → QR cũ tự động vô hiệu
    public RestaurantTable regenerateQrCode(Long tableId) {
        RestaurantTable table = tableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Bàn không tồn tại"));
        generateQrCode(table);          // Tạo token mới, ghi đè qrCodeToken cũ
        return tableRepository.save(table);
    }

    // Lấy tất cả bàn (kể cả đã deactivate) — dành cho Admin
    public List<RestaurantTable> getAllTablesAdmin() {
        return tableRepository.findAll();
    }
}

# Kế hoạch đồ án theo chương (Restaurant AI)

Tài liệu này map **nội dung luận văn** với **hạng mục triển khai trong mã nguồn**. Cập nhật dần khi hoàn thành từng phần.

## Chương 1 — Giới thiệu

| Việc cần làm | Ghi chú |
|--------------|---------|
| Bối cảnh, lý do chọn đề tài | Viết trong Word/LaTeX |
| Mục tiêu & phạm vi | Gắn với 4 luồng: khách vãng lai, khách đăng ký, staff, admin |
| Cấu trúc luận văn | Liệt kê chương 2–5 |

**Code:** không bắt buộc.

---

## Chương 2 — Cơ sở lý thuyết

| Việc cần làm | Ghi chú |
|--------------|---------|
| Kiến trúc web, REST API, JWT (nếu dùng) | |
| QR code, luồng đặt món tại bàn | |
| WebSocket / thông báo thời gian thực (nếu có) | |
| AI chatbot: rule-based vs LLM (trung thực với hệ thống) | |

**Code:** có thể trích hình từ Swagger/OpenAPI khi backend đủ.

---

## Chương 3 — Phân tích & yêu cầu

| Việc cần làm | Ghi chú |
|--------------|---------|
| Sơ đồ use case theo 4 tác nhân | Dùng lại luồng đã mô tả |
| Bảng yêu chức năng (chức năng / ưu tiên) | |
| Yêu cầu phi chức năng: bảo mật, hiệu năng demo | |

**Code:** không bắt buộc; có thể chụp màn hình wireframe.

---

## Chương 4 — Thiết kế hệ thống

| Việc cần làm | Ghi chú |
|--------------|---------|
| Sơ đồ kiến trúc tổng thể (client – API – DB) | |
| ER diagram khớp Flyway | `restaurant-backend1/src/main/resources/db/migration/` |
| Sequence: quét QR → xem menu → tạo đơn | |
| Sequence: đặt bàn → xác nhận → check-in | |
| RBAC (ADMIN / STAFF / USER) | Mô tả endpoint + `@PreAuthorize` |

**Code:** bổ sung sơ đồ vào repo (ảnh/svg) nếu khoa yêu cầu.

---

## Chương 5 — Triển khai & kiểm thử

Thực hiện **theo thứ tự ưu tiên** (đồng thời là nội dung demo bảo vệ).

| Thứ tự | Hạng mục | Trạng thái | File / ghi chú |
|--------|----------|------------|----------------|
| 5.1 | Khách vãng lai: QR trong URL → nhận bàn → giỏ theo token → `POST /orders/guest` | Đã có bản đầu | `index/qr-session.js`, `menu.js`, `menu-detail.html`, `giohang.html`, `giohang.js` |
| 5.2 | Theo dõi đơn theo `qrToken` (`GET /orders/guest/table/{qrToken}`) | Đã gắn trên `giohang.html` (danh sách đơn đang xử lý) | Có thể tách trang riêng hoặc thêm auto-refresh |
| 5.3 | Gọi nhân viên + thông báo staff | Chưa | API + admin `goinv.html` |
| 5.4 | Khách đăng ký: đặt bàn, lịch sử, đơn gắn user | Một phần | `datban.*`, `lichsu.*` |
| 5.5 | Staff: đơn, trạng thái bàn, thanh toán | Chưa | `admin/donhang.*`, API staff |
| 5.6 | Admin: menu, bàn/QR, dashboard, đánh giá | Một phần | `admin/*` |
| 5.7 | Kiểm thử: checklist + vài case API (Postman) | Chưa | |

---

## Checklist nghiệm thu luồng khách

### A) Khách vãng lai (quét QR)

| Mục | Trạng thái | Ghi chú |
|-----|------------|---------|
| Quét QR -> nhận token bàn (`?t=`) | PASS | `index/qr-session.js` |
| Hiển thị banner thông tin bàn | PASS | `GET /api/tables/qr/{token}` trong `menu.js` |
| Xem menu và thêm giỏ theo token | PASS | `menu.js`, `menu-detail.html` |
| Gửi đơn khách vãng lai | PARTIAL | API `POST /api/orders/guest` có thể thiếu trong source; FE đã có fallback demo tại `giohang.js` |
| Theo dõi đơn theo token bàn | PARTIAL | API `GET /api/orders/guest/table/{qrToken}` có thể thiếu; FE fallback demo |
| Gọi nhân viên từ trang giỏ | PARTIAL | FE đã thêm nút gọi; ưu tiên API `POST /api/call-staff/guest` để chạy thực |

### B) Khách hàng đăng ký

| Mục | Trạng thái | Ghi chú |
|-----|------------|---------|
| Đăng nhập tài khoản | PASS/DEPENDENT | FE có `dangnhap.js`; phụ thuộc API auth ở backend đang chạy |
| Đặt bàn khi đã đăng nhập | PARTIAL | FE `datban.js` gọi `POST /api/reservations`; cần backend xác nhận |
| Xem lịch sử đặt bàn | PARTIAL | FE `lichsu.js` gọi `/api/reservations/me`; tab lịch sử đơn còn placeholder |
| Lịch sử đơn hàng theo user | FAIL | Chưa hoàn thiện ở FE/BE trong repo hiện tại |

---

## Gợi ý URL demo QR (frontend)

- Menu có mã bàn: `index/menu.html?t=<qr_code_token>`
- Giỏ hàng: `index/giohang.html` (token lưu `sessionStorage` sau khi mở menu có `t=`)

**Dữ liệu bàn + token:** Flyway `V1.0.7__seed_tables_demo_qr.sql` (B01–B06, token `demo-qr-b01` … `demo-qr-b06`).

**Admin in QR:** `codefe/admin/sodoban.html` — chỉnh URL menu khách, sinh ảnh QR (`qrcodejs`), tải PNG / sao chép link. `sodoban.js` gọi lần lượt `GET .../tables/staff/tables`, `.../staff/tables`, `.../admin/tables` (Bearer JWT) tùy cách bạn map controller; không khớp endpoint nào thì dùng danh sách fallback (seed V1.0.7).

Mã QR in thực tế nên trỏ tới URL public của `menu.html` (HTTPS khi deploy).

---

## Xử lý lỗi 500 khi gọi `GET .../staff/tables` (hoặc `/admin/tables`)

**Ý nghĩa:** `500` là **lỗi phía server** — request đã tới được controller (hoặc filter), nhưng trong lúc xử lý có **exception** (khác với `404` “không có API”).

**Cách chẩn đoán:** Mở console chạy Spring Boot (IntelliJ / terminal), tìm **stack trace** ngay lúc gọi API. Thường gặp:

1. **`LazyInitializationException` (Hibernate)**  
   Controller trả về entity `RestaurantTable` có quan hệ `@OneToMany(fetch = LAZY)` (orders, reservations, call_staffs…). Jackson serialize JSON → chạm vào collection lazy **ngoài** transaction → lỗi.

   **Cách sửa (chọn một):**
   - Trả về **DTO** chỉ gồm field cần cho FE: `id`, `tableNumber`, `capacity`, `location`, `qrCodeToken`, `status` (map trong service).
   - Hoặc trên entity: `@JsonIgnore` các list quan hệ, và thêm `@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})` cho class.

2. **Vòng lặp JSON / `StackOverflowError`**  
   `Table` → `Order` → `Table` → … Do `@JsonManagedReference` / `@JsonBackReference` thiếu hoặc serialize hai chiều.

3. **Lệch DB ↔ entity**  
   Cột SQL đổi tên nhưng mapping JPA chưa cập nhật → SQLException bọc trong 500.

4. **`/api/admin/tables`**  
   Nếu vẫn báo kiểu **static resource** hoặc 500 tùy cấu hình: endpoint này có thể **chưa được implement**; ưu tiên sửa **`/staff/tables`** (hoặc `/tables/staff/tables`) cho đúng như trên.

**FE:** `sodoban.js` nếu mọi endpoint đều lỗi thì **tự dùng danh sách fallback** (B01–B06) để in QR demo — trang vẫn dùng được khi sửa backend xong.

**Đã áp dụng trong repo:** `RestaurantTable` có `@JsonIgnore` trên các collection LAZY (phòng khi còn chỗ trả entity). API bàn dùng **`RestaurantTableResponse`** map trong `TableController`: `GET /api/tables/staff/tables`, **`GET /api/tables/admin/tables`** (admin), và các endpoint tạo/sửa/trạng thái/QR trả DTO.

**Nếu log vẫn báo** `...ApiResponse["data"]->...RestaurantTable["orders"]`: bản đang chạy **vẫn trả entity** (chưa merge `TableController` + DTO hoặc chưa **Rebuild / Restart** Spring Boot). `sodoban.js` chỉ gọi `/api/tables/staff/tables` và `/api/tables/admin/tables`.

Nếu project đã có `ApiResponse` riêng: giữ bản đó, merge `RestaurantTableResponse` + method `getAllTables`/`listAllTablesForAdmin` trả `List<RestaurantTableResponse>`; xóa `ApiResponse.java` trùng nếu conflict.

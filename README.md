# 🍽️ Hệ thống Quản lý Nhà hàng tích hợp QR & Hỗ trợ thông minh (Restaurant AI)

**Đồ án tốt nghiệp — Khoa Công nghệ Thông tin, Đại học Duy Tân**  
**Ngành: Công nghệ Phần mềm**

---

## 📋 Thông tin dự án

| Thông tin          | Chi tiết                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| **Tên đề tài**     | *Xây dựng hệ thống quản lý nhà hàng: đặt món theo QR, đặt bàn, hỗ trợ trực tuyến (AI chatbot) và phân tầng vận hành (Admin / Nhân viên / Khách hàng)* — cập nhật theo đúng tên trên tờ trình |
| **Nhóm sinh viên** | Phạm Phước Lợi (L), Đặng Huỳnh Tường Vy, Phạm Thị Thùy Linh, Phan Quốc Mạnh, Triệu Văn Ý |
| **GVHD**           | ThS. Phạm Phú Khương                                                    |
| **Thời gian**      | 24/02/2026 – 15/05/2026                                                  |

---

## 📖 Giới thiệu

Dự án hướng tới **số hóa vận hành nhà hàng** trên nền web: khách hàng có thể gọi món nhanh qua **mã QR gắn bàn**, theo dõi đơn, đặt bàn và xem lịch sử; **nhân viên** xử lý đơn, bàn, thanh toán; **quản trị** quản lý thực đơn, bàn, thống kê và tài khoản. Hệ thống tích hợp **bảo mật JWT**, đăng nhập **Google OAuth2**, thông tin thời gian thực qua **WebSocket**, và **chatbot hỗ trợ** (tích hợp API AI — xem cấu hình backend).

### Tính năng chính

- **Khách vãng lai (QR)** — Gắn phiên theo `qrToken` trên URL, xem menu, giỏ hàng, tạo đơn tại bàn, theo dõi trạng thái đơn.
- **Khách đăng ký** — Đặt bàn, lịch sử đơn hàng, đánh giá dịch vụ (theo mức triển khai hiện tại).
- **Nhân viên (STAFF)** — Xử lý đơn, trạng thái bàn, gọi nhân viên / tiếp nhận yêu cầu, quy trình vận hành tại quầy.
- **Quản trị (ADMIN)** — Tổng quan, quản lý menu, bàn/QR, đơn hàng, thanh toán, người dùng, thống kê, v.v.
- **Bảo mật & phân quyền** — Phân tầng theo vai trò; API REST chuẩn hóa, có tài liệu OpenAPI (Swagger).
- **Thông báo & thời gian thực** — WebSocket phục vụ tương tác/notify theo nghiệp vụ cấu hình trên server.

---

## 🗂️ Cấu trúc dự án (Standardized)

Dự án được tổ chức theo cấu trúc thực tế trong repository:

```
Gr18/
├── codefe/                 # Giao diện Web (HTML / CSS / JavaScript thuần)
│   ├── index/              # Khu vực khách: menu, giỏ, đặt bàn, lịch sử, chatbot, QR…
│   ├── admin/              # Khu vực quản trị & nhân viên: đơn, bàn, thống kê…
│   ├── dangnhap.html, dangky.html, …
│   └── …
├── restaurant-backend1/    # API & nghiệp vụ (Spring Boot)
│   ├── src/main/java/      # Controllers, services, security, WebSocket, …
│   ├── src/main/resources/ # Cấu hình, migration Flyway
│   ├── build.gradle
│   ├── env.example         # Mẫu biến môi trường (MySQL, JWT, Mail, OAuth, Gemini, …)
│   └── …
├── docs/                   # Tài liệu kèm theo (kế hoạch đồ án, …)
└── README.md
```

| Thành phần   | Công nghệ chính | Mô tả |
| ------------ | --------------- | ----- |
| **Backend**  | Java 22, Spring Boot 3, Spring Security, JPA, MySQL, WebSocket, OAuth2, JWT, Flyway, Springdoc OpenAPI | REST API, nghiệp vụ, migration DB, tài liệu API |
| **Frontend** | HTML5, CSS, JavaScript (client), fetch/XHR tới API | Giao diện khách & admin, tải component động (`component-loader.js`) |
| **Database** | MySQL | Lưu trữ dữ liệu quan hệ (cấu hình qua `DB_*` / Spring datasource) |
| **Tích hợp** | Gmail SMTP, Google Gemini (chatbot), Cloudinary (ảnh món, tùy cấu hình), ZXing (QR) | Email, AI, lưu trữ media, sinh/đọc QR |

---

## 🛠️ Công nghệ sử dụng

### Backend (`restaurant-backend1`)

- **Runtime / ngôn ngữ:** Java 22  
- **Framework:** Spring Boot 3.5.x (Web, Data JPA, Security, Mail, WebSocket, OAuth2 Client)  
- **Database:** MySQL (connector runtime)  
- **Migration:** Flyway  
- **Bảo mật:** JWT (JJWT 0.12.x), mật khẩu băm, phân quyền theo method & matcher  
- **Tài liệu API:** Springdoc OpenAPI (Swagger UI)  
- **Khác:** MapStruct, Lombok, Google API Client, ZXing (QR)

### Frontend Web (`codefe`)

- **Công nghệ:** Trang tĩnh + JavaScript, không bắt buộc build step (có thể mở qua dev server tùy chọn)  
- **Gọi API:** `fetch` / biến `API_BASE` / `RESTAURANT_API_BASE` (một số file dùng `http://localhost:8080/api` — cần đồng bộ khi triển khai)

---

## ⚙️ Cài đặt & Chạy

### Yêu cầu môi trường

- **JDK** 22  
- **MySQL** (tạo DB hoặc dùng `createDatabaseIfNotExist` như chuỗi URL mẫu)  
- (Tùy chọn) **Gradle** dùng wrapper có sẵn trong thư mục backend  

### 1. Backend (Spring Boot)

```bash
cd restaurant-backend1
# Sao chép env.example thành .env hoặc .evn (xem ghi chú trong env.example) và điền:
#   DB_*, JWT_SECRET, MAIL_*, GOOGLE_OAUTH2_*, GEMINI_API_KEY, …
# Windows (PowerShell):
.\gradlew.bat bootRun
# Linux / macOS:
# ./gradlew bootRun
```

- API (mặc định): `http://localhost:8080/api` (xem `server.port` và `server.servlet.context-path` trong `application.properties`).

- Swagger UI (thường dùng): mở trình duyệt tại đường dẫn do Springdoc cấp hình, ví dụ:  
  `http://localhost:8080/api/swagger-ui/index.html` (nếu bật và không đổi path).

### 2. Frontend (Web)

Mở thư mục `codefe` bằng Live Server (VS Code), **hoặc** phục vụ tĩnh:

```bash
cd codefe
npx --yes serve -p 3000
```

Sau đó cấu hình base URL API cho đúng backend (các file JS có `localhost:8080/api` — chỉnh nếu deploy host/port khác; có thể dùng `window.RESTAURANT_API_BASE` nơi đã hỗ trợ).



---

## 🔒 Phân quyền hệ thống (tóm tắt)

| Vai trò    | Mô tả gợi ý |
| ---------- | ------------------------------------------------------------------------ |
| **ADMIN**  | Cấu hình hệ thống, quản lý bàn/QR, thống kê, nhiều endpoint chỉ dành cho admin. |
| **STAFF**  | Thao tác vận hành: đơn, bàn, gọi nhân viên, khu vực phục vụ tại quán.   |
| **USER**   | Khách đăng nhập: đặt bàn, lịch sử, tương tác theo quy định API.          |
| **Khách (guest)** | Luồng QR / token: đặt món theo bàn, một số API guest không cần đăng nhập. |

*Chi tiết từng endpoint xem annotation `@PreAuthorize` và `SecurityConfig` trong backend.*

---

## 👤 Nhóm tác giả

| Họ và tên                 | MSSV        | Vai trò     |
| ------------------------- | ----------- | ----------- |
| **Phạm Phước Lợi**        | 28219006506 | Nhóm trưởng |
| **Đặng Huỳnh Tường Vy**  | 28204624378 | Thành viên  |
| **Phạm Thị Thùy Linh**   | 28201132244 | Thành viên  |
| **Phan Quốc Mạnh**       | 28210201440 | Thành viên  |
| **Triệu Văn Ý**          | 28211104056 | Thành viên  |

---

## 📄 Bản quyền học thuật

```
Academic Use Only

Dự án này là tài sản học thuật thuộc chương trình đào tạo của Đại học Duy Tân.
Nghiêm cấm sao chép hoặc sử dụng cho mục đích thương mại khi chưa có sự đồng ý của nhóm tác giả.
Copyright © 2026 - Nhóm đồ án Gr18 (Restaurant AI).
```

# 🍽️ RESTAURANT AI SYSTEM 🤖  
## 🚀 Hệ thống quản lý nhà hàng thông minh tích hợp AI & QR Ordering  

<p align="center">
  <img src="https://img.shields.io/badge/Backend-SpringBoot-brightgreen"/>
  <img src="https://img.shields.io/badge/Frontend-JS%20%7C%20Bootstrap-blue"/>
  <img src="https://img.shields.io/badge/Database-MySQL-orange"/>
  <img src="https://img.shields.io/badge/Status-In%20Development-yellow"/>
</p>

---

## 🚧 TRẠNG THÁI DỰ ÁN

> ⚠️ Dự án hiện đang **trong quá trình phát triển**
>
> - Một số chức năng đang được hoàn thiện  
> - Hệ thống có thể chưa ổn định hoàn toàn  
> - Sẽ tiếp tục được cập nhật trong các phiên bản tiếp theo  

---

## 📌 MỤC LỤC
- 📖 Giới thiệu  
- ✨ Tính năng nổi bật  
- 🏗️ Kiến trúc hệ thống  
- 🛠️ Công nghệ sử dụng  
- ⚙️ Yêu cầu môi trường  
- 🗄️ Cấu hình Database  
- ▶️ Khởi chạy hệ thống  
- 🔐 Tài khoản demo  
- 👨‍💻 Nhóm phát triển  
- 🚀 Hướng phát triển  

---

## 📖 GIỚI THIỆU

**Restaurant AI System** là hệ thống quản lý nhà hàng hiện đại, giúp:

- Tối ưu quy trình vận hành  
- Giảm tải công việc cho nhân viên  
- Nâng cao trải nghiệm khách hàng  

💡 **Điểm nổi bật:**
- Gọi món bằng **QR Code tại bàn**  
- Tích hợp **AI gợi ý món ăn thông minh**  
- Quản lý toàn bộ hoạt động nhà hàng  

🔥 **Phù hợp cho:** Nhà hàng, quán ăn, cafe, mô hình F&B  

---

## ✨ TÍNH NĂNG NỔI BẬT

### 🛒 Gọi món thông minh (QR Ordering)
- Quét QR → Xem menu → Đặt món  
- Không cần nhân viên ghi order  
- Cập nhật trạng thái đơn hàng realtime  

### 🤖 Trợ lý AI
- Gợi ý món ăn theo sở thích  
- Tư vấn combo tối ưu  
- Chat hỗ trợ khách hàng  

### 📊 Quản lý & Dashboard
- Quản lý món ăn, danh mục  
- Theo dõi doanh thu theo ngày/tháng/năm  
- Thống kê trực quan  

### 🧾 Đặt bàn & vận hành
- Đặt bàn trước  
- Xác nhận lịch đặt  
- Quản lý số lượng khách  

### 👥 Phân quyền người dùng
- Admin  
- Staff  
- Customer  

---

## 🏗️ KIẾN TRÚC HỆ THỐNG

Client (Web / QR)
        ↓
Frontend (HTML + JS + Bootstrap)
        ↓
REST API (Spring Boot)
        ↓
Database (MySQL)


💡 **Áp dụng:**
- Layered Architecture (Controller → Service → Repository)  
- RESTful API  
- JWT Authentication  

---

## 🛠️ CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ |
|----------|---------|
| Backend | Spring Boot (Java) |
| Frontend | HTML, CSS, JavaScript, Bootstrap |
| Database | MySQL |
| Authentication | JWT |
| AI Integration | OpenAI API |

---

## ⚙️ YÊU CẦU MÔI TRƯỜNG

- Java JDK 17+  
- MySQL Server  
- IntelliJ IDEA / VS Code  
- Postman  

---

## 🗄️ CẤU HÌNH DATABASE

### ▶️ Tạo database
```sql
CREATE DATABASE restaurant_ai;

📁 application.properties

▶️ CHẠY HỆ THỐNG
Backend
Mở project bằng IntelliJ
Run file:
RestaurantAiApplication.java
Frontend
Mở file:
index.html
hoặc dùng Live Server

👨‍💻 NHÓM PHÁT TRIỂN

🎓 Đồ án tốt nghiệp – Đại học Duy Tân

STT	Họ và tên	Vai trò
1	Phạm Phước Lợi	Backend + AI
2	Triệu Văn Ý	Frontend
3	Đặng Huỳnh Tường Vy	Tester
4	Phạm Thị Thùy Linh Backend + Database
5       Phan Quốc Mạnh Frontend

🚀 HƯỚNG PHÁT TRIỂN
Thanh toán online (VNPay, Momo)
Mobile App (Flutter)
Voice Ordering
AI Recommendation nâng cao
⭐ ĐÁNH GIÁ

✔️ Fullstack hoàn chỉnh
✔️ Có AI thực tế
✔️ Có thể triển khai thật

Nếu muốn nâng thêm level nữa, mình có thể làm cho bạn:

🔥 Banner README kiểu xịn (có logo riêng)
🎯 Demo GIF (quét QR → gọi món)
📊 Sơ đồ UML (use case, sequence)

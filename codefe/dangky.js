/**
 * Project: Restaurant AI - Nhóm 18
 * File: dangky.js
 * Chức năng: Xử lý đăng ký tài khoản khách hàng và điều hướng
 */

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Chặn hành động load lại trang mặc định của Form

            // 1. Lấy dữ liệu từ các ô Input (ID phải khớp với file dangky.html)
            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // 2. Kiểm tra logic phía Client (Validation)
            if (password !== confirmPassword) {
                alert('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại!');
                return;
            }

            if (password.length < 6) {
                alert('Mật khẩu phải có ít nhất 6 ký tự!');
                return;
            }

            // 3. Hiệu ứng Loading cho nút bấm
            registerBtn.disabled = true;
            const originalBtnText = registerBtn.innerHTML;
            registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...';

            // 4. Tạo Object dữ liệu gửi đi (Payload)
            const payload = {
                fullName: fullName,
                email: email,
                phone: phone,
                password: password
            };

            try {
                // 5. Gọi API Đăng ký bằng Axios
                // Lưu ý: Đảm bảo Backend Spring Boot đang chạy ở port 8080
                const response = await axios.post('http://localhost:8080/api/auth/register', payload);

                // 6. Xử lý khi Backend trả về thành công (success: true)
                if (response.data.success) {
                    const userData = response.data.data;

                    // LƯU Ý CHO NHÓM: Tự động đăng nhập luôn sau khi đăng ký thành công
                    // Lưu Token và thông tin vào LocalStorage
                    localStorage.setItem('accessToken', userData.accessToken);
                    localStorage.setItem('refreshToken', userData.refreshToken);
                    localStorage.setItem('userInfo', JSON.stringify({
                        userId: userData.userId,
                        fullName: userData.fullName,
                        role: userData.role,
                        email: userData.email || email || "",
                        phone: userData.phone || phone || ""
                    }));

                    alert('Đăng ký tài khoản thành công! Chào mừng ' + userData.fullName);

                    // Điều hướng thẳng vào trang chủ dành cho khách hàng
                    // Cấu trúc: thư mục index -> file home.html
                    window.location.href = 'dangnhap.html';
                }

            } catch (error) {
                // 7. Xử lý lỗi (Lỗi 400, 401, 500 hoặc mất kết nối)
                console.error('Register Error:', error);
                
                // Lấy thông báo lỗi từ GlobalExceptionHandler của Backend
                const errorMsg = error.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại kết nối Server!';
                alert('Lỗi: ' + errorMsg);

            } finally {
                // 8. Trả lại trạng thái nút bấm ban đầu
                registerBtn.disabled = false;
                registerBtn.innerHTML = originalBtnText;
            }
        });
    }
});
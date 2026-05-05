/**
 * Project: Restaurant AI - Nhóm 18
 * File: dangnhap.js
 */

// [DN-1] Guard toastr để tránh ReferenceError nếu thư viện load thất bại
if (typeof toastr !== 'undefined') {
    toastr.options = {
        "closeButton": true,
        "progressBar": true,
        "positionClass": "toast-top-right",
        "timeOut": "3000",
    };
}

// 1. LUỒNG ĐĂNG NHẬP GOOGLE
async function handleGoogleLogin(response) {
    const idToken = response.credential;
    toastr.info("Đang xác thực tài khoản Google...", "Thông báo");

    try {
        const res = await axios.post('http://localhost:8080/api/auth/google', {
            token: idToken
        });

        if (res.data.success) {
            saveUserAndRedirect(res.data.data);
        } else {
            if (typeof toastr !== 'undefined') {
                toastr.error(res.data.message || 'Tài khoản Google không hợp lệ hoặc chưa được đăng ký.');
            } else {
                alert(res.data.message || 'Tài khoản Google không hợp lệ.');
            }
        }
    } catch (error) {
        console.error('Lỗi Google Login:', error);
        const msg = error.response?.data?.message || "Không thể kết nối đến server";
        toastr.error('Đăng nhập Google thất bại: ' + msg);
    }
}

// 2. LUỒNG ĐĂNG NHẬP THÔNG THƯỜNG
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            loginBtn.disabled = true;
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xác thực...';

            const payload = {
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value
            };

            try {
                const response = await axios.post('http://localhost:8080/api/auth/login', payload);

                if (response.data.success) {
                    saveUserAndRedirect(response.data.data);
                } else {
                    toastr.warning(response.data.message || "Tài khoản không hợp lệ");
                }
            } catch (error) {
                console.error('Login Error:', error);
                const msg = error.response?.data?.message || 'Sai tài khoản hoặc mật khẩu!';
                toastr.error(msg, 'Đăng nhập thất bại');
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
            }
        });
    }
});

/** Chỉ cho phép đường dẫn tương đối an toàn sau đăng nhập (chống open redirect). */
function safeNextPath(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const next = raw.trim();
    if (next.includes('..') || next.startsWith('/') || next.includes('://')) return null;
    if (next.startsWith('index/') || next.startsWith('admin/')) return next;
    return null;
}

function saveUserAndRedirect(userData) {
    localStorage.setItem('accessToken', userData.accessToken);
    localStorage.setItem('refreshToken', userData.refreshToken);
    localStorage.setItem('token', userData.accessToken);

    let oldUser = {};
    try {
        oldUser = JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch (e) {
        oldUser = {};
    }

    localStorage.setItem('userInfo', JSON.stringify({
        userId: userData.userId,
        fullName: userData.fullName,
        role: userData.role,
        email: userData.email || oldUser.email || "",
        phone: userData.phone || oldUser.phone || ""
    }));

    toastr.success(`Chào mừng ${userData.fullName} quay trở lại!`, 'Thành công');

    setTimeout(() => {
        const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
        if (next) {
            window.location.href = next;
            return;
        }
        if (userData.role === 'ADMIN' || userData.role === 'STAFF') {
            window.location.href = 'admin/tongquan.html';
        } else {
            window.location.href = 'index/home.html';
        }
    }, 1200);
}

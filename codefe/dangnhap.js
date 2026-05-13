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
        const res = await axios.post('https://gr18.onrender.com/api/auth/google', {
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
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    let otpCooldownTimer = null;
    let otpCooldownRemain = 0;

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
                const response = await axios.post('https://gr18.onrender.com/api/auth/login', payload);

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

    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            if (otpCooldownRemain > 0) {
                notify('warning', `Vui lòng chờ ${otpCooldownRemain}s trước khi gửi lại OTP`);
                return;
            }
            const forgotEmail = document.getElementById('forgotEmail');
            const email = forgotEmail?.value?.trim() || '';
            if (!email) {
                notify('warning', 'Vui lòng nhập email để nhận OTP');
                forgotEmail?.focus();
                return;
            }

            sendOtpBtn.disabled = true;
            const oldText = sendOtpBtn.innerHTML;
            sendOtpBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang gửi...';
            try {
                const res = await axios.post('https://gr18.onrender.com/api/auth/forgot-password', { email });
                notify('success', res.data?.message || 'Nếu email tồn tại, OTP đã được gửi');
                startOtpCooldown(sendOtpBtn, 60);
            } catch (error) {
                const msg = error.response?.data?.message || 'Không gửi được mã OTP';
                notify('error', msg, 'Lỗi');
            } finally {
                if (otpCooldownRemain <= 0) {
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.innerHTML = oldText;
                }
            }
        });
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('forgotEmail')?.value?.trim() || '';
            const otpCode = document.getElementById('resetOtpCode')?.value?.trim() || '';
            const newPassword = document.getElementById('newPassword')?.value || '';
            const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';

            if (!email || !otpCode || !newPassword || !confirmPassword) {
                notify('warning', 'Vui lòng nhập đầy đủ thông tin');
                return;
            }
            if (!/^\d{6}$/.test(otpCode)) {
                notify('warning', 'OTP phải gồm đúng 6 chữ số');
                return;
            }
            if (newPassword.length < 6) {
                notify('warning', 'Mật khẩu mới phải từ 6 ký tự');
                return;
            }
            if (newPassword !== confirmPassword) {
                notify('warning', 'Mật khẩu nhập lại không khớp');
                return;
            }

            if (resetPasswordBtn) {
                resetPasswordBtn.disabled = true;
                resetPasswordBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang cập nhật...';
            }
            try {
                const res = await axios.post('https://gr18.onrender.com/api/auth/reset-password', {
                    email,
                    otpCode,
                    newPassword
                });
                notify('success', res.data?.message || 'Đặt lại mật khẩu thành công');
                forgotPasswordForm.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'));
                modal?.hide();
            } catch (error) {
                const msg = error.response?.data?.message || 'Đặt lại mật khẩu thất bại';
                notify('error', msg, 'Lỗi');
            } finally {
                if (resetPasswordBtn) {
                    resetPasswordBtn.disabled = false;
                    resetPasswordBtn.innerHTML = 'Đặt lại mật khẩu';
                }
            }
        });
    }

    function startOtpCooldown(button, seconds) {
        if (!button || seconds <= 0) return;
        if (otpCooldownTimer) {
            clearInterval(otpCooldownTimer);
            otpCooldownTimer = null;
        }
        otpCooldownRemain = seconds;
        button.disabled = true;
        button.textContent = `Gửi lại OTP sau ${otpCooldownRemain}s`;
        otpCooldownTimer = setInterval(() => {
            otpCooldownRemain -= 1;
            if (otpCooldownRemain <= 0) {
                clearInterval(otpCooldownTimer);
                otpCooldownTimer = null;
                otpCooldownRemain = 0;
                button.disabled = false;
                button.textContent = 'Gửi mã OTP';
                return;
            }
            button.textContent = `Gửi lại OTP sau ${otpCooldownRemain}s`;
        }, 1000);
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
        phone: userData.phone || oldUser.phone || "",
        allowedPagesJson: typeof userData.allowedPagesJson === 'string' ? userData.allowedPagesJson : (oldUser.allowedPagesJson || "")
    }));

    toastr.success(`Chào mừng ${userData.fullName} quay trở lại!`, 'Thành công');

    setTimeout(() => {
        const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
        if (next) {
            window.location.href = next;
            return;
        }
        if (userData.role === 'ADMIN' || userData.role === 'STAFF') {
            if (userData.role === 'STAFF') {
                const nextStaff = pickStaffLandingPage(userData.allowedPagesJson);
                window.location.href = 'admin/' + nextStaff;
            } else {
                window.location.href = 'admin/tongquan.html';
            }
        } else {
            window.location.href = 'index/home.html';
        }
    }, 1200);
}

function pickStaffLandingPage(allowedPagesJson) {
    const fallback = 'donhang.html';
    const priority = ['donhang.html', 'qlthanhtoan.html', 'datcho.html', 'qltrangthaiban.html', 'goinv.html'];
    try {
        const raw = typeof allowedPagesJson === 'string' ? allowedPagesJson : '';
        if (!raw.trim()) return fallback;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || !arr.length) return fallback;
        for (const p of priority) {
            if (arr.includes(p)) return p;
        }
    } catch (e) {}
    return fallback;
}

function notify(type, message, title = 'Thông báo') {
    if (typeof toastr !== 'undefined') {
        if (type === 'success') toastr.success(message, title);
        else if (type === 'warning') toastr.warning(message, title);
        else if (type === 'error') toastr.error(message, title);
        else toastr.info(message, title);
        return;
    }
    alert(message);
}

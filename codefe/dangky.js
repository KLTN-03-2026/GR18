/**
 * Project: Restaurant AI - Nhóm 18
 * File: dangky.js
 * Chức năng: Xử lý đăng ký tài khoản khách hàng và điều hướng
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof toastr !== 'undefined') {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            positionClass: 'toast-top-right',
            timeOut: 3500
        };
    }

    const DRAFT_KEY = 'registerFormDraft_v1';
    const PHONE_VN = /^0[35789][0-9]{8}$/;

    function getApiBase() {
        const b =
            typeof window.RESTAURANT_API_BASE === 'string' && window.RESTAURANT_API_BASE.trim()
                ? window.RESTAURANT_API_BASE.trim().replace(/\/+$/, '')
                : 'http://localhost:8080/api';
        return b;
    }

    /** Đã có phiên đăng nhập: không cho mở form đăng ký thêm tài khoản. */
    function redirectIfAuthenticated() {
        const t = localStorage.getItem('accessToken') || localStorage.getItem('token');
        if (!t || !String(t).trim()) return;
        let role = '';
        try {
            role = String(JSON.parse(localStorage.getItem('userInfo') || '{}').role || '').toUpperCase();
        } catch (_) {
            /* ignore */
        }
        if (role === 'ADMIN' || role === 'STAFF') {
            window.location.replace('admin/tongquan.html');
        } else {
            window.location.replace('index/home.html');
        }
    }

    redirectIfAuthenticated();

    function restoreDraft() {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const d = JSON.parse(raw);
            if (!d || typeof d !== 'object') return;
            ['fullName', 'email', 'phone', 'password', 'confirmPassword'].forEach((id) => {
                const el = document.getElementById(id);
                if (el && d[id] != null) el.value = String(d[id]);
            });
        } catch (_) {
            /* ignore */
        }
    }

    let draftTimer = null;
    function scheduleSaveDraft() {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(saveDraft, 350);
    }

    function saveDraft() {
        try {
            const d = {
                fullName: document.getElementById('fullName')?.value ?? '',
                email: document.getElementById('email')?.value ?? '',
                phone: document.getElementById('phone')?.value ?? '',
                password: document.getElementById('password')?.value ?? '',
                confirmPassword: document.getElementById('confirmPassword')?.value ?? ''
            };
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
        } catch (_) {
            /* ignore */
        }
    }

    function clearDraft() {
        try {
            sessionStorage.removeItem(DRAFT_KEY);
        } catch (_) {
            /* ignore */
        }
    }

    /** Toastr có thể ném lỗi (vd. thiếu jQuery); không được để bọc vào catch đăng ký axios. */
    function notifyRegisterSuccess(fullName) {
        const msg = 'Chào mừng ' + fullName + '! Vui lòng đăng nhập.';
        try {
            if (typeof window.jQuery !== 'undefined' && typeof toastr !== 'undefined') {
                toastr.success(msg, 'Đăng ký thành công');
                return;
            }
        } catch (e) {
            console.warn('toastr không dùng được:', e);
        }
        alert('Đăng ký thành công! ' + msg);
    }

    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');

    const errors = {
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    };

    function setError(field, msg) {
        errors[field] = msg;
        const errEl = document.getElementById('err-' + field);
        const inputEl = document.getElementById(field);
        if (errEl) errEl.textContent = msg;
        if (inputEl) inputEl.classList.toggle('is-invalid', !!msg);
    }

    function clearErrors() {
        Object.keys(errors).forEach((field) => setError(field, ''));
    }

    function validatePassword(v) {
        if (!v) return 'Mật khẩu không được để trống.';
        if (v.length < 6) return 'Mật khẩu phải từ 6 đến 100 ký tự.';
        if (!/^[A-Z]/.test(v)) return 'Mật khẩu phải bắt đầu bằng chữ cái viết hoa.';
        if (!/[!@#$%^&*]/.test(v)) return 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*).';
        return '';
    }

    function validate(fullName, email, phone, password, confirmPassword) {
        let valid = true;

        if (!fullName) {
            setError('fullName', 'Họ và tên không được để trống.');
            valid = false;
        } else if (fullName.length < 2 || fullName.length > 100) {
            setError('fullName', 'Họ và tên phải từ 2 đến 100 ký tự.');
            valid = false;
        } else {
            setError('fullName', '');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setError('email', 'Email không được để trống.');
            valid = false;
        } else if (!emailRegex.test(email)) {
            setError('email', 'Email không đúng định dạng (vd: abc@gmail.com).');
            valid = false;
        } else {
            setError('email', '');
        }

        if (!phone) {
            setError('phone', 'Số điện thoại không được để trống.');
            valid = false;
        } else if (!PHONE_VN.test(phone)) {
            setError('phone', 'Số điện thoại không hợp lệ.');
            valid = false;
        } else {
            setError('phone', '');
        }

        const passwordMsg = validatePassword(password);
        if (passwordMsg) {
            setError('password', passwordMsg);
            valid = false;
        } else {
            setError('password', '');
        }

        if (!confirmPassword) {
            setError('confirmPassword', 'Vui lòng xác nhận mật khẩu.');
            valid = false;
        } else if (confirmPassword !== password) {
            setError('confirmPassword', 'Mật khẩu xác nhận không khớp.');
            valid = false;
        } else {
            setError('confirmPassword', '');
        }

        return valid;
    }

    function applyServerFieldErrors(body) {
        const map = body?.data;
        if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
        let any = false;
        ['fullName', 'email', 'phone', 'password'].forEach((f) => {
            const m = map[f];
            if (m != null && String(m).trim()) {
                setError(f, String(m));
                any = true;
            }
        });
        return any;
    }

    if (registerForm) {
        restoreDraft();

        registerForm.addEventListener('input', scheduleSaveDraft);

        const blurRules = {
            fullName: (v) => {
                const t = (v || '').trim();
                if (!t) return 'Họ và tên không được để trống.';
                if (t.length < 2 || t.length > 100) return 'Họ và tên phải từ 2 đến 100 ký tự.';
                return '';
            },
            email: (v) =>
                !v.trim()
                    ? 'Email không được để trống.'
                    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
                      ? 'Email không đúng định dạng (vd: abc@gmail.com).'
                      : '',
            phone: (v) => {
                const t = (v || '').trim();
                if (!t) return 'Số điện thoại không được để trống.';
                return PHONE_VN.test(t) ? '' : 'Số điện thoại không hợp lệ.';
            },
            password: (v) => validatePassword(v),
            confirmPassword: (v) => {
                const pw = document.getElementById('password').value;
                return !v ? 'Vui lòng xác nhận mật khẩu.' : v !== pw ? 'Mật khẩu xác nhận không khớp.' : '';
            }
        };
        Object.keys(blurRules).forEach((field) => {
            const el = document.getElementById(field);
            if (el)
                el.addEventListener('blur', () => {
                    setError(field, blurRules[field](el.value));
                });
        });

        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                const cleaned = phoneInput.value.replace(/[^0-9]/g, '');
                if (phoneInput.value !== cleaned) phoneInput.value = cleaned;
                if (cleaned.length === 0) {
                    setError('phone', '');
                } else if (!PHONE_VN.test(cleaned)) {
                    setError('phone', 'Số điện thoại không hợp lệ.');
                } else {
                    setError('phone', '');
                }
            });
            phoneInput.addEventListener('keydown', (e) => {
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                if (allowed.includes(e.key) || (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))) return;
                if (!/^[0-9]$/.test(e.key)) e.preventDefault();
            });
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            clearErrors();
            const serverErrEl = document.getElementById('err-server');
            if (serverErrEl) serverErrEl.textContent = '';
            if (!validate(fullName, email, phone, password, confirmPassword)) return;

            registerBtn.disabled = true;
            const originalBtnText = registerBtn.innerHTML;
            registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...';

            const payload = {
                fullName: fullName,
                email: email,
                phone: phone,
                password: password
            };

            try {
                const response = await axios.post(getApiBase() + '/auth/register', payload);

                const body = response.data;
                if (body.success && body.data) {
                    clearDraft();
                    const displayName = body.data.fullName || fullName;
                    notifyRegisterSuccess(displayName);

                    /** Không lưu JWT / userInfo sau đăng ký — chỉ sang màn đăng nhập. */
                    setTimeout(function () {
                        window.location.href = 'dangnhap.html';
                    }, 2000);
                } else {
                    const elFail = document.getElementById('err-server');
                    if (applyServerFieldErrors(body)) {
                        if (elFail) elFail.textContent = body.message || '';
                    } else if (elFail) {
                        elFail.textContent = body.message || 'Đăng ký không thành công.';
                    }
                }
            } catch (error) {
                console.error('Register Error:', error);
                const res = error.response?.data;
                const el = document.getElementById('err-server');
                if (res && typeof res === 'object') {
                    if (applyServerFieldErrors(res) && el) {
                        el.textContent = res.message || '';
                        return;
                    }
                    if (el) el.textContent = res.message || error.message || 'Đăng ký thất bại. Vui lòng kiểm tra kết nối.';
                } else if (el) {
                    el.textContent = error.message || 'Đăng ký thất bại. Vui lòng kiểm tra kết nối.';
                }
            } finally {
                registerBtn.disabled = false;
                registerBtn.innerHTML = originalBtnText;
            }
        });
    }
});

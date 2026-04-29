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
        Object.keys(errors).forEach(field => setError(field, ''));
    }

    function validatePassword(v) {
        if (!v) return 'Mật khẩu không được để trống.';
        if (!/^[A-Z]/.test(v)) return 'Mật khẩu phải bắt đầu bằng chữ cái viết hoa.';
        if (!/[!@#$%^&*]/.test(v)) return 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*).';
        return '';
    }

    function validate(fullName, email, phone, password, confirmPassword) {
        let valid = true;

        if (!fullName) {
            setError('fullName', 'Họ và tên không được để trống.');
            valid = false;
        } else if (fullName.length > 200) {
            setError('fullName', 'Họ và tên tối đa 200 ký tự.');
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

        const phoneRegex = /^[0-9]{10}$/;
        if (!phone) {
            setError('phone', 'Số điện thoại không được để trống.');
            valid = false;
        } else if (!phoneRegex.test(phone)) {
            setError('phone', 'Số điện thoại phải gồm đúng 10 chữ số.');
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

    if (registerForm) {
        const blurRules = {
            fullName: v => !v ? 'Họ và tên không được để trống.' : v.length > 200 ? 'Họ và tên tối đa 200 ký tự.' : '',
            email: v => !v ? 'Email không được để trống.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Email không đúng định dạng (vd: abc@gmail.com).' : '',
            phone: v => !v ? 'Số điện thoại không được để trống.' : !/^[0-9]{10}$/.test(v) ? 'Số điện thoại phải gồm đúng 10 chữ số.' : '',
            password: v => validatePassword(v),
            confirmPassword: v => {
                const pw = document.getElementById('password').value;
                return !v ? 'Vui lòng xác nhận mật khẩu.' : v !== pw ? 'Mật khẩu xác nhận không khớp.' : '';
            }
        };
        Object.keys(blurRules).forEach(field => {
            const el = document.getElementById(field);
            if (el) el.addEventListener('blur', () => {
                setError(field, blurRules[field](el.value.trim ? el.value.trim() : el.value));
            });
        });

        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', () => {
                const cleaned = phoneInput.value.replace(/[^0-9]/g, '');
                if (phoneInput.value !== cleaned) phoneInput.value = cleaned;
                if (cleaned.length === 0) {
                    setError('phone', '');
                } else if (cleaned.length < 10) {
                    setError('phone', 'Số điện thoại phải gồm đúng 10 chữ số (đã nhập ' + cleaned.length + '/10).');
                } else {
                    setError('phone', '');
                }
            });
            phoneInput.addEventListener('keydown', (e) => {
                const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
                if (allowed.includes(e.key) || (e.ctrlKey && ['a','c','v','x'].includes(e.key.toLowerCase()))) return;
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
                const response = await axios.post('http://localhost:8080/api/auth/register', payload);

                if (response.data.success) {
                    const userData = response.data.data;

                    localStorage.setItem('accessToken', userData.accessToken);
                    localStorage.setItem('refreshToken', userData.refreshToken);
                    localStorage.setItem('token', userData.accessToken);
                    localStorage.setItem('userInfo', JSON.stringify({
                        userId: userData.userId,
                        fullName: userData.fullName,
                        role: userData.role,
                        email: userData.email || email || "",
                        phone: userData.phone || phone || ""
                    }));

                    if (typeof toastr !== 'undefined') {
                        toastr.success('Chào mừng ' + userData.fullName + '! Vui lòng đăng nhập.', 'Đăng ký thành công');
                    } else {
                        alert('Đăng ký tài khoản thành công! Chào mừng ' + userData.fullName);
                    }
                    setTimeout(function () {
                        window.location.href = 'dangnhap.html';
                    }, 2000);
                }

            } catch (error) {
                console.error('Register Error:', error);
                const errorMsg = error.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại kết nối Server!';
                const el = document.getElementById('err-server');
                if (el) el.textContent = errorMsg;

            } finally {
                registerBtn.disabled = false;
                registerBtn.innerHTML = originalBtnText;
            }
        });
    }
});

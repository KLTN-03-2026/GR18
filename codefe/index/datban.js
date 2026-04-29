/**
 * Project: Restaurant AI - Nhóm 18
 * Chức năng: Xử lý đặt bàn trực tuyến
 * Khách vãng lai: xem trang + điền form; chỉ khi bấm xác nhận mới cần đăng nhập.
 */

const LOGIN_PAGE = '../dangnhap.html';
const AFTER_LOGIN_PATH = 'index/datban.html';

function getAccessToken() {
    return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function redirectToLogin() {
    const next = encodeURIComponent(AFTER_LOGIN_PATH);
    window.location.href = `${LOGIN_PAGE}?next=${next}`;
}

function toastOk(msg, title) {
    if (typeof toastr !== 'undefined') toastr.success(msg, title || 'Thành công');
    else alert((title ? title + ': ' : '') + msg);
}
function toastErr(msg) {
    if (typeof toastr !== 'undefined') toastr.error(msg, 'Lỗi');
    else alert('Lỗi: ' + msg);
}
function toastWarn(msg) {
    if (typeof toastr !== 'undefined') toastr.warning(msg);
    else alert(msg);
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof toastr !== 'undefined') {
        toastr.options = { closeButton: true, progressBar: true, positionClass: 'toast-top-right', timeOut: 4000 };
    }

    const reservationForm = document.getElementById('reservationForm');
    const submitBtn = document.getElementById('submitBtn');
    const guestHint = document.getElementById('guest-login-hint');

    const token = getAccessToken();
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

    if (!token && guestHint) {
        guestHint.classList.remove('d-none');
    }

    if (reservationForm) {
        reservationForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const authToken = getAccessToken();
            if (!authToken) {
                alert('Vui lòng đăng nhập để xác nhận đặt bàn.');
                redirectToLogin();
                return;
            }

            // 2. Lấy dữ liệu từ Form
            const date = document.getElementById('resDate').value;
            const time = document.getElementById('resTime').value;
            const guests = document.getElementById('guests').value;
            const phoneEl = document.getElementById('customerPhone');
            const customerPhone = (phoneEl?.value || '').trim();
            const note = document.getElementById('note').value;
            const area = document.querySelector('input[name="area"]:checked').value;

            if (!customerPhone) {
                toastWarn('Vui lòng nhập số điện thoại liên hệ.');
                phoneEl?.focus();
                return;
            }

            // 3. Định dạng lại thời gian cho đúng LocalDateTime của Backend (YYYY-MM-DDTHH:mm:ss)
            const reservationTime = `${date}T${time}:00`;

            // 4. Chuẩn bị dữ liệu gửi đi (Khớp với ReservationRequest.java)
            const payload = {
                reservationTime: reservationTime,
                numberOfGuests: parseInt(guests),
                customerName: userInfo.fullName || "Khách hàng",
                customerPhone: customerPhone,
                tableId: null, // Hệ thống tự động xếp bàn trống
                note: `Khu vực mong muốn: ${area}. Ghi chú: ${note}`
            };

            try {
                // Hiệu ứng chờ
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

                // 5. Gọi API Backend
                const response = await axios.post('http://localhost:8080/api/reservations', payload, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                if (response.data.success) {
                    toastOk(
                        'Hẹn gặp bạn vào ' + new Date(reservationTime).toLocaleString('vi-VN'),
                        'Đặt bàn thành công'
                    );
                    setTimeout(function () {
                        window.location.href = 'lichsu.html';
                    }, 1500);
                }

            } catch (error) {
                console.error('Booking Error:', error);
                // Hiển thị thông báo lỗi từ Backend (Ví dụ: trùng giờ, quá khứ...)
                const message = error.response?.data?.message || "Đặt bàn thất bại. Vui lòng thử lại!";
                toastErr(message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Xác nhận đặt bàn';
            }
        });
    }
});
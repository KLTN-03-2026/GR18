/**
 * Project: Restaurant AI - Nhóm 18
 * Chức năng: Xử lý lịch sử Đặt bàn/Đặt món & Xem chi tiết
 */

const BASE_URL = 'http://localhost:8080/api';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof toastr !== 'undefined') {
        toastr.options = { closeButton: true, progressBar: true, positionClass: 'toast-top-right', timeOut: 3500 };
    }

    const token = localStorage.getItem('accessToken');
    const tableBody = document.getElementById('historyTableBody');

    const detailModal = new bootstrap.Modal(document.getElementById('reservationDetailModal'));

    if (!token) {
        if (typeof toastr !== 'undefined') toastr.warning('Vui lòng đăng nhập để xem lịch sử!');
        else alert("Vui lòng đăng nhập để xem lịch sử!");
        window.location.href = '../dangnhap.html';
        return;
    }

    // ================= FORMAT DATE =================
    function formatDate(dateData) {
        if (!dateData) return "N/A";

        // ✅ xử lý backend trả array
        if (Array.isArray(dateData)) {
            const [y, m, d, h = 0, min = 0] = dateData;
            const date = new Date(y, m - 1, d, h, min);
            return date.toLocaleDateString('vi-VN');
        }

        const date = new Date(dateData);
        if (isNaN(date)) return "Invalid";

        return date.toLocaleDateString('vi-VN');
    }

    function formatDateTime(dateData) {
        if (!dateData) return "N/A";

        if (Array.isArray(dateData)) {
            const [y, m, d, h = 0, min = 0] = dateData;
            return `${d}/${m}/${y} ${h}:${min.toString().padStart(2, '0')}`;
        }

        const date = new Date(dateData);
        if (isNaN(date)) return "Invalid";

        return date.toLocaleString('vi-VN', {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    // ================= FETCH =================
    async function fetchHistory() {
        try {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5">
                        <div class="spinner-border text-orange"></div>
                    </td>
                </tr>`;

            const response = await axios.get(`${BASE_URL}/reservations/me?page=0&size=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                renderTable(response.data.data.content);
            }

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger py-4">
                        Không thể kết nối Server.
                    </td>
                </tr>`;
        }
    }

    // ================= RENDER =================
    function renderTable(data) {
        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">
                        Không có lịch sử nào.
                    </td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = data.map(item => {

            const date = formatDate(item.reservationTime);

            // badge
            let badgeClass = 'badge bg-warning text-dark';
            let statusVN = 'Chờ duyệt';

            if (item.status === 'CONFIRMED' || item.status === 'COMPLETED') {
                badgeClass = 'badge bg-success';
                statusVN = 'Hoàn thành';
            } else if (item.status === 'CANCELLED') {
                badgeClass = 'badge bg-danger';
                statusVN = 'Đã hủy';
            }

            return `
                <tr>
                    <td>${date}</td>
                    <td><b class="text-orange">Đặt bàn</b></td>
                    <td>
                        Bàn ${item.tableNumber || 'Chưa xếp'} 
                        (${item.numberOfGuests} khách)
                    </td>
                    <td><span class="${badgeClass}">${statusVN}</span></td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm px-3"
                            onclick="showReservationDetail(${item.id})">
                            Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ================= DETAIL =================
    window.showReservationDetail = async (id) => {
        const modalBody = document.getElementById('modalContent');
        const cancelBtn = document.getElementById('cancelBtnInModal');

        modalBody.innerHTML = `<div class="text-center"><div class="spinner-border"></div></div>`;
        detailModal.show();

        try {
            const response = await axios.get(`${BASE_URL}/reservations/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const item = response.data.data.content.find(r => r.id === id);

            if (!item) return;

            modalBody.innerHTML = `
                <div>
                    <p><b>Mã đơn:</b> #${item.id}</p>
                    <p><b>Khách:</b> ${item.customerName}</p>
                    <p><b>SĐT:</b> ${item.customerPhone}</p>
                    <p><b>Thời gian:</b> ${formatDateTime(item.reservationTime)}</p>
                    <p><b>Số khách:</b> ${item.numberOfGuests}</p>
                    <p><b>Bàn:</b> ${item.tableNumber || 'Chờ xếp'}</p>
                    <p><b>Ghi chú:</b><br>${item.note || 'Không có'}</p>
                </div>
            `;

            // show cancel button
            if (item.status === 'CONFIRMED' || item.status === 'PENDING') {
                cancelBtn.classList.remove('d-none');
                cancelBtn.onclick = () => handleCancel(item.id);
            } else {
                cancelBtn.classList.add('d-none');
            }

        } catch (error) {
            modalBody.innerHTML = `<p class="text-danger">Lỗi tải chi tiết</p>`;
        }
    };

    // ================= CANCEL =================
    async function handleCancel(id) {
        if (!confirm("Bạn có chắc muốn hủy?")) return;

        try {
            const response = await axios.delete(`${BASE_URL}/reservations/${id}/cancel`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                if (typeof toastr !== 'undefined') toastr.success('Đã hủy thành công!', 'Thành công');
                else alert("Đã hủy thành công!");
                detailModal.hide();
                fetchHistory();
            }

        } catch (error) {
            const m = error.response?.data?.message || "Không thể hủy";
            if (typeof toastr !== 'undefined') toastr.error(m, 'Lỗi');
            else alert("Lỗi: " + m);
        }
    }

    // ================= FILTER =================
    document.getElementById('filterBooking').addEventListener('click', fetchHistory);
    document.getElementById('filterAll').addEventListener('click', fetchHistory);
    document.getElementById('filterOrder').addEventListener('click', () => {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    Chức năng đặt món đang phát triển...
                </td>
            </tr>`;
    });

    // load lần đầu
    fetchHistory();
});
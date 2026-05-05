/**
 * Restaurant AI — Lịch sử: đặt bàn + đơn món (đã đăng nhập)
 */

const BASE_URL = "http://localhost:8080/api";

document.addEventListener("DOMContentLoaded", () => {
    if (typeof toastr !== "undefined") {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            positionClass: "toast-top-right",
            timeOut: 3500,
        };
    }

    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    const tableBody = document.getElementById("historyTableBody");
    const btnAll = document.getElementById("filterAll");
    const btnOrder = document.getElementById("filterOrder");
    const btnBooking = document.getElementById("filterBooking");
    const detailModal = new bootstrap.Modal(document.getElementById("reservationDetailModal"));
    let currentTab = "all";

    if (!token) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <i class="fa-solid fa-user-lock fa-2x text-muted mb-3 d-block" aria-hidden="true"></i>
                    <p class="text-muted fw-semibold mb-0">Vui lòng đăng nhập để xem lịch sử.</p>
                </td>
            </tr>`;
        const fg = document.querySelector(".history-card .filter-group");
        if (fg) fg.style.display = "none";
        return;
    }

    function escapeHtml(s) {
        if (s == null) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function coerceApiDate(dateData) {
        if (typeof dateData !== "string") return dateData;
        return dateData.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/, "$1T$2");
    }

    function formatDate(dateData) {
        if (!dateData) return "N/A";
        if (Array.isArray(dateData)) {
            const [y, m, d] = dateData;
            const date = new Date(y, m - 1, d);
            return date.toLocaleDateString("vi-VN");
        }
        const date = new Date(coerceApiDate(dateData));
        if (isNaN(date)) return "—";
        return date.toLocaleDateString("vi-VN");
    }

    function formatDateTime(dateData) {
        if (!dateData) return "N/A";
        if (Array.isArray(dateData)) {
            const [y, m, d, h = 0, min = 0] = dateData;
            return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y} ${h}:${String(min).padStart(2, "0")}`;
        }
        const date = new Date(coerceApiDate(dateData));
        if (isNaN(date)) return "—";
        return date.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    /** Tóm tắt bàn + vị trí trong danh sách lịch sử đặt bàn */
    function bookingRowSummary(item) {
        const n = item.numberOfGuests;
        if (!item.tableNumber) return `Chưa xếp (${n} khách)`;
        const loc = item.tableLocation ? ` · ${escapeHtml(item.tableLocation)}` : "";
        return `Bàn ${escapeHtml(item.tableNumber)}${loc} (${n} khách)`;
    }

    function toTimestamp(dateData) {
        if (!dateData) return 0;
        if (Array.isArray(dateData)) {
            const [y, m, d, h = 0, min = 0, sec = 0] = dateData;
            return new Date(y, m - 1, d, h, min, sec).getTime();
        }
        const coerced = coerceApiDate(dateData);
        const t = new Date(coerced).getTime();
        return isNaN(t) ? 0 : t;
    }

    function formatVND(n) {
        return Number(n || 0).toLocaleString("vi-VN") + " đ";
    }

    function orderStatusLabel(st) {
        const m = {
            PENDING: "Chờ xử lý",
            PREPARING: "Đang chuẩn bị",
            SERVING: "Đang phục vụ",
            COMPLETED: "Hoàn thành",
            CANCELLED: "Đã hủy",
        };
        return m[st] || st || "—";
    }

    function paymentLabel(ps) {
        const m = { UNPAID: "Chưa thanh toán", PAID: "Đã thanh toán", REFUNDED: "Đã hoàn tiền" };
        return m[ps] || ps || "—";
    }

    function paymentMethodLabel(pm) {
        if (!pm) return "—";
        const m = { CASH: "Tiền mặt", QR_CODE: "QR / chuyển khoản", CARD: "Thẻ", BANK_TRANSFER: "Chuyển khoản" };
        return m[pm] || pm;
    }

    function setFilterActive(which) {
        [btnAll, btnOrder, btnBooking].forEach((b) => {
            if (!b) return;
            b.classList.remove("btn-orange-filter", "active");
            b.classList.add("btn-light-filter");
        });
        const map = { all: btnAll, order: btnOrder, booking: btnBooking };
        const el = map[which];
        if (el) {
            el.classList.remove("btn-light-filter");
            el.classList.add("btn-orange-filter", "active");
        }
    }

    function showLoading() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <div class="spinner-border text-orange" role="status"></div>
                    <p class="mt-2 text-muted mb-0">Đang tải...</p>
                </td>
            </tr>`;
    }

    function showFetchError() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-4">
                    Không thể kết nối máy chủ.
                </td>
            </tr>`;
    }

    async function fetchBookings() {
        const response = await axios.get(`${BASE_URL}/reservations/me?page=0&size=50`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data && response.data.success && response.data.data && response.data.data.content) {
            return response.data.data.content;
        }
        return [];
    }

    async function fetchOrders() {
        const response = await axios.get(`${BASE_URL}/orders/me?page=0&size=50`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const payload = response.data && response.data.data;
        const content = payload && payload.content;
        return Array.isArray(content) ? content : [];
    }

    function renderBookingRows(bookings) {
        if (!bookings || !bookings.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">Không có lịch sử đặt bàn.</td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = bookings
            .map((item) => {
                const date = formatDate(item.reservationTime);
                let badgeClass = "badge bg-warning text-dark";
                let statusVN = "Chờ duyệt";
                if (item.status === "CONFIRMED" || item.status === "COMPLETED") {
                    badgeClass = "badge bg-success";
                    statusVN = "Hoàn thành";
                } else if (item.status === "CANCELLED") {
                    badgeClass = "badge bg-danger";
                    statusVN = "Đã hủy";
                }
                return `
                <tr>
                    <td>${date}</td>
                    <td><b class="text-orange">Đặt bàn</b></td>
                    <td>${bookingRowSummary(item)}</td>
                    <td><span class="${badgeClass}">${statusVN}</span></td>
                    <td>
                        <button type="button" class="btn btn-outline-danger btn-sm px-3"
                            onclick="openBookingDetail(${item.id})">
                            Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>`;
            })
            .join("");
    }

    function renderOrderRows(orders) {
        if (!orders || !orders.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">Không có đơn hàng.</td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = orders
            .map((o) => {
                const date = formatDate(o.createdAt);
                const st = orderStatusLabel(o.status);
                let badgeClass = "badge bg-warning text-dark";
                if (o.status === "COMPLETED") badgeClass = "badge bg-success";
                else if (o.status === "CANCELLED") badgeClass = "badge bg-danger";
                else if (o.status === "PREPARING" || o.status === "SERVING") badgeClass = "badge bg-info text-dark";

                const pay = paymentLabel(o.paymentStatus);
                const brief = `Bàn ${escapeHtml(o.tableNumber || "?")} · ${formatVND(o.totalAmount)} · ${escapeHtml(
                    pay
                )}`;

                return `
                <tr>
                    <td>${date}</td>
                    <td><b class="text-primary">Đơn món</b></td>
                    <td class="text-start ps-4">${brief}</td>
                    <td><span class="${badgeClass}">${st}</span></td>
                    <td>
                        <button type="button" class="btn btn-outline-danger btn-sm px-3"
                            onclick="openOrderDetail(${o.id})">
                            Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>`;
            })
            .join("");
    }

    function renderMerged(bookings, orders) {
        const rows = [];
        (bookings || []).forEach((b) =>
            rows.push({ kind: "booking", ts: toTimestamp(b.reservationTime), booking: b })
        );
        (orders || []).forEach((o) => rows.push({ kind: "order", ts: toTimestamp(o.createdAt), order: o }));
        rows.sort((a, b) => b.ts - a.ts);

        if (!rows.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">Chưa có lịch sử.</td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = rows
            .map((r) => {
                if (r.kind === "booking") {
                    const item = r.booking;
                    const date = formatDate(item.reservationTime);
                    let badgeClass = "badge bg-warning text-dark";
                    let statusVN = "Chờ duyệt";
                    if (item.status === "CONFIRMED" || item.status === "COMPLETED") {
                        badgeClass = "badge bg-success";
                        statusVN = "Hoàn thành";
                    } else if (item.status === "CANCELLED") {
                        badgeClass = "badge bg-danger";
                        statusVN = "Đã hủy";
                    }
                    return `
                    <tr>
                        <td>${date}</td>
                        <td><b class="text-orange">Đặt bàn</b></td>
                        <td>${bookingRowSummary(item)}</td>
                        <td><span class="${badgeClass}">${statusVN}</span></td>
                        <td>
                            <button type="button" class="btn btn-outline-danger btn-sm px-3"
                                onclick="openBookingDetail(${item.id})">
                                Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                            </button>
                        </td>
                    </tr>`;
                }
                const o = r.order;
                const date = formatDate(o.createdAt);
                const st = orderStatusLabel(o.status);
                let badgeClass = "badge bg-warning text-dark";
                if (o.status === "COMPLETED") badgeClass = "badge bg-success";
                else if (o.status === "CANCELLED") badgeClass = "badge bg-danger";
                else if (o.status === "PREPARING" || o.status === "SERVING") badgeClass = "badge bg-info text-dark";
                const pay = paymentLabel(o.paymentStatus);
                const brief = `Bàn ${escapeHtml(o.tableNumber || "?")} · ${formatVND(o.totalAmount)} · ${escapeHtml(
                    pay
                )}`;
                return `
                    <tr>
                        <td>${date}</td>
                        <td><b class="text-primary">Đơn món</b></td>
                        <td class="text-start ps-4">${brief}</td>
                        <td><span class="${badgeClass}">${st}</span></td>
                        <td>
                            <button type="button" class="btn btn-outline-danger btn-sm px-3"
                                onclick="openOrderDetail(${o.id})">
                                Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                            </button>
                        </td>
                    </tr>`;
            })
            .join("");
    }

    async function refresh() {
        showLoading();
        try {
            if (currentTab === "booking") {
                const bookings = await fetchBookings();
                renderBookingRows(bookings);
            } else if (currentTab === "order") {
                const orders = await fetchOrders();
                renderOrderRows(orders);
            } else {
                const [bookings, orders] = await Promise.all([fetchBookings(), fetchOrders()]);
                renderMerged(bookings, orders);
            }
        } catch (e) {
            console.error(e);
            showFetchError();
        }
    }

    window.openBookingDetail = async (id) => {
        const modalBody = document.getElementById("modalContent");
        const cancelBtn = document.getElementById("cancelBtnInModal");
        const modalTitle = document.getElementById("historyModalTitle");
        if (modalTitle)
            modalTitle.innerHTML =
                '<i class="fa-solid fa-utensils me-2"></i>Chi tiết đặt bàn';

        modalBody.innerHTML = `<div class="text-center"><div class="spinner-border"></div></div>`;
        detailModal.show();

        try {
            const response = await axios.get(`${BASE_URL}/reservations/me?page=0&size=50`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            let list =
                response.data &&
                response.data.success &&
                response.data.data &&
                response.data.data.content
                    ? response.data.data.content
                    : [];
            const item = Array.isArray(list) ? list.find((r) => r.id === id) : null;

            if (!item) {
                modalBody.innerHTML = `<p class="text-muted">Không tìm thấy đặt bàn.</p>`;
                cancelBtn.classList.add("d-none");
                return;
            }

            modalBody.innerHTML = `
                <div>
                    <p><b>Mã đặt:</b> #${item.id}</p>
                    <p><b>Khách:</b> ${escapeHtml(item.customerName)}</p>
                    <p><b>SĐT:</b> ${escapeHtml(item.customerPhone)}</p>
                    <p><b>Thời gian:</b> ${formatDateTime(item.reservationTime)}</p>
                    <p><b>Số khách:</b> ${item.numberOfGuests}</p>
                    <p><b>Bàn:</b> ${item.tableNumber ? `${escapeHtml(item.tableNumber)}${item.tableLocation ? ` · ${escapeHtml(item.tableLocation)}` : ""}` : "Chờ xếp"}</p>
                    <p><b>Ghi chú:</b><br>${escapeHtml(item.note || "Không có")}</p>
                </div>`;

            if (item.status === "CONFIRMED" || item.status === "PENDING") {
                cancelBtn.classList.remove("d-none");
                cancelBtn.onclick = () => handleCancel(item.id);
            } else cancelBtn.classList.add("d-none");
        } catch (error) {
            modalBody.innerHTML = `<p class="text-danger">Lỗi tải chi tiết</p>`;
            cancelBtn.classList.add("d-none");
        }
    };

    window.openOrderDetail = async (orderId) => {
        const modalBody = document.getElementById("modalContent");
        const cancelBtn = document.getElementById("cancelBtnInModal");
        const modalTitle = document.getElementById("historyModalTitle");
        if (modalTitle)
            modalTitle.innerHTML =
                '<i class="fa-solid fa-receipt me-2"></i>Chi tiết đơn hàng';

        cancelBtn.classList.add("d-none");
        modalBody.innerHTML = `<div class="text-center"><div class="spinner-border"></div></div>`;
        detailModal.show();

        try {
            const response = await axios.get(`${BASE_URL}/orders/me/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const d = response.data && response.data.data ? response.data.data : null;
            if (!d) {
                modalBody.innerHTML = `<p class="text-muted">Không có dữ liệu.</p>`;
                return;
            }

            const items = Array.isArray(d.items) ? d.items : [];
            const lines = items.length
                ? `<ul class="list-group list-group-flush small">${items
                      .map(
                          (li) =>
                              `<li class="list-group-item px-0 d-flex justify-content-between align-items-start">
                                  <span>${escapeHtml(li.itemName)} × ${li.quantity}<br/>
                                  <span class="text-muted">${escapeHtml(li.note || "")}</span></span>
                                  <span class="fw-semibold">${formatVND(li.subtotal)}</span>
                              </li>`
                      )
                      .join("")}</ul>`
                : `<p class="text-muted mb-0">Không có dòng món.</p>`;

            modalBody.innerHTML = `
                <div>
                    <p><b>Mã đơn:</b> #${d.id}</p>
                    <p><b>Ngày đặt:</b> ${formatDateTime(d.createdAt)}</p>
                    <p><b>Bàn:</b> ${escapeHtml(d.tableNumber || "?")}</p>
                    <p><b>Trạng thái đơn:</b> ${escapeHtml(orderStatusLabel(d.status))}</p>
                    <p><b>Thanh toán:</b> ${escapeHtml(paymentLabel(d.paymentStatus))}
                        ${d.paymentMethod ? " · " + escapeHtml(paymentMethodLabel(d.paymentMethod)) : ""}
                    </p>
                    ${d.paidAt ? `<p><b>Thanh toán lúc:</b> ${formatDateTime(d.paidAt)}</p>` : ""}
                    ${d.note ? `<p><b>Ghi chú đơn:</b><br>${escapeHtml(d.note)}</p>` : ""}
                    <p class="fw-bold mb-2">Chi tiết món:</p>
                    ${lines}
                    <p class="fs-5 fw-bold text-orange mt-3 mb-0">Tổng cộng: ${formatVND(d.totalAmount)}</p>
                </div>`;
        } catch (error) {
            const msg =
                (error.response && error.response.data && error.response.data.message) ||
                "Không thể tải chi tiết đơn.";
            modalBody.innerHTML = `<p class="text-danger">${escapeHtml(msg)}</p>`;
        }
    };

    async function handleCancel(id) {
        if (!confirm("Bạn có chắc muốn hủy đặt bàn?")) return;

        try {
            const response = await axios.delete(`${BASE_URL}/reservations/${id}/cancel`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data && response.data.success) {
                if (typeof toastr !== "undefined") toastr.success("Đã hủy thành công!", "Thành công");
                else alert("Đã hủy thành công!");
                detailModal.hide();
                refresh();
            }
        } catch (error) {
            const m = (error.response && error.response.data && error.response.data.message) || "Không thể hủy";
            if (typeof toastr !== "undefined") toastr.error(m, "Lỗi");
            else alert("Lỗi: " + m);
        }
    }

    btnAll.addEventListener("click", () => {
        currentTab = "all";
        setFilterActive("all");
        refresh();
    });
    btnOrder.addEventListener("click", () => {
        currentTab = "order";
        setFilterActive("order");
        refresh();
    });
    btnBooking.addEventListener("click", () => {
        currentTab = "booking";
        setFilterActive("booking");
        refresh();
    });

    setFilterActive("all");
    refresh();
});


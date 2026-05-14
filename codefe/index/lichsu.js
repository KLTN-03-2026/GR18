/**
 * Restaurant AI — Lịch sử: đặt bàn + đơn món (đã đăng nhập)
 */

const BASE_URL = String(
    (typeof window !== "undefined" && window.API_BASE) || ""
).replace(/\/+$/, "");

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
    /** Container card cho mobile (<768px). Có thể null trên trang phiên bản cũ. */
    const cardList = document.getElementById("historyCardList");
    const btnAll = document.getElementById("filterAll");
    const btnOrder = document.getElementById("filterOrder");
    const btnBooking = document.getElementById("filterBooking");
    const detailModal = new bootstrap.Modal(document.getElementById("reservationDetailModal"));
    const paginationNav = document.getElementById("historyPaginationNav");
    const paginationEl = document.getElementById("historyPagination");
    const paginationMeta = document.getElementById("historyPaginationMeta");
    const PAGE_SIZE = 10;
    let currentTab = "all";
    let currentPage = 1;
    let cachedBookings = [];
    let cachedOrders = [];

    if (!token) {
        const loginPrompt = `
            <i class="fa-solid fa-user-lock fa-2x text-muted mb-3 d-block" aria-hidden="true"></i>
            <p class="text-muted fw-semibold mb-0">Vui lòng đăng nhập để xem lịch sử.</p>`;
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-5">${loginPrompt}</td></tr>`;
        if (cardList) cardList.innerHTML = `<div class="text-center py-5">${loginPrompt}</div>`;
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

    /** Đồng bộ với ReservationStatus backend */
    function bookingStatusLabel(st) {
        const key = String(st || "").toUpperCase();
        const m = {
            PENDING: "Chờ",
            CONFIRMED: "Đã xác nhận",
            ARRIVED: "Đã đến",
            CANCELLED: "Đã hủy",
            COMPLETED: "Hoàn thành",
        };
        return m[key] || st || "—";
    }

    function bookingStatusBadgeClass(st) {
        const key = String(st || "").toUpperCase();
        if (key === "PENDING") return "badge bg-warning text-dark";
        if (key === "CONFIRMED") return "badge bg-primary";
        if (key === "ARRIVED") return "badge bg-success";
        if (key === "CANCELLED") return "badge bg-danger";
        if (key === "COMPLETED") return "badge bg-secondary";
        return "badge bg-light text-dark";
    }

    function bookingStatusDescription(st) {
        const key = String(st || "").toUpperCase();
        const m = {
            PENDING:
                "Trạng thái mặc định sau khi bạn gửi yêu cầu đặt bàn trực tuyến. Lúc này yêu cầu đang chờ hệ thống xử lý và giữ chỗ.",
            CONFIRMED:
                "Đơn đặt bàn đã được kiểm tra tình trạng bàn trống và xác nhận thành công. Trạng thái bàn tại nhà hàng được cập nhật thành Đã đặt (Reserved).",
            ARRIVED:
                "Khách đã có mặt tại nhà hàng đúng giờ hẹn (nhân viên đã tiếp nhận qua chức năng Tiếp nhận khách đặt bàn). Bàn chuyển sang Đang sử dụng để phục vụ và gọi món.",
            CANCELLED:
                "Đơn đã hủy trước giờ hẹn. Hệ thống giải phóng bàn và cập nhật trạng thái bàn về Còn trống.",
            COMPLETED: "Buổi đặt bàn đã được kết thúc trong hệ thống.",
        };
        return m[key] || "";
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

    /** Đặt cùng một thông điệp cho table (desktop) + card list (mobile). */
    function setHistoryMessage(html, extraTrClass = "") {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-5 ${extraTrClass}">${html}</td></tr>`;
        if (cardList) cardList.innerHTML = `<div class="text-center py-5 ${extraTrClass}">${html}</div>`;
    }

    function showLoading() {
        setHistoryMessage(`
            <div class="spinner-border text-orange" role="status"></div>
            <p class="mt-2 text-muted mb-0">Đang tải...</p>`);
        renderPagination(0);
    }

    function showFetchError() {
        setHistoryMessage(`Không thể kết nối máy chủ.`, "text-danger");
        renderPagination(0);
    }

    // ============================================================
    // Mobile card markup (dùng chung cho 3 nhánh render)
    // ============================================================
    function bookingCardHtml(item) {
        const date = formatDate(item.reservationTime);
        const statusKey = String(item.status || "").toUpperCase();
        const badgeClass = bookingStatusBadgeClass(statusKey);
        const statusVN = bookingStatusLabel(statusKey);
        return `
        <div class="history-card-item" data-action="booking" data-id="${item.id}" role="button" tabindex="0">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                <span class="small text-muted">${date}</span>
                <span class="${badgeClass}">${escapeHtml(statusVN)}</span>
            </div>
            <div class="fw-bold text-orange mb-1">Đặt bàn</div>
            <div class="text-secondary small">${bookingRowSummary(item)}</div>
        </div>`;
    }

    function orderCardHtml(o) {
        const date = formatDate(o.createdAt);
        const st = orderStatusLabel(o.status);
        let badgeClass = "badge bg-warning text-dark";
        if (o.status === "COMPLETED") badgeClass = "badge bg-success";
        else if (o.status === "CANCELLED") badgeClass = "badge bg-danger";
        else if (o.status === "PREPARING" || o.status === "SERVING") badgeClass = "badge bg-info text-dark";
        const pay = paymentLabel(o.paymentStatus);
        const brief = `Bàn ${escapeHtml(o.tableNumber || "?")} · ${formatVND(o.totalAmount)} · ${escapeHtml(pay)}`;
        return `
        <div class="history-card-item" data-action="order" data-id="${o.id}" role="button" tabindex="0">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                <span class="small text-muted">${date}</span>
                <span class="${badgeClass}">${escapeHtml(st)}</span>
            </div>
            <div class="fw-bold text-primary mb-1">Đơn món</div>
            <div class="text-secondary small">${brief}</div>
        </div>`;
    }

    function setCardList(html) {
        if (cardList) cardList.innerHTML = html;
    }

    function getPageSlice(items) {
        const list = Array.isArray(items) ? items : [];
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return {
            pageItems: list.slice(start, end),
            total,
            start,
            end: Math.min(end, total),
            totalPages,
        };
    }

    function renderPagination(totalItems) {
        if (!paginationEl || !paginationNav || !paginationMeta) return;
        if (!totalItems) {
            paginationEl.innerHTML = "";
            paginationNav.classList.add("d-none");
            paginationMeta.textContent = "";
            return;
        }
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const start = (currentPage - 1) * PAGE_SIZE + 1;
        const end = Math.min(currentPage * PAGE_SIZE, totalItems);
        paginationMeta.textContent = `Hiển thị ${start}-${end} trên ${totalItems}`;

        if (totalPages <= 1) {
            paginationEl.innerHTML = "";
            paginationNav.classList.add("d-none");
            return;
        }

        const maxButtons = 5;
        let from = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let to = Math.min(totalPages, from + maxButtons - 1);
        if (to - from + 1 < maxButtons) from = Math.max(1, to - maxButtons + 1);

        const parts = [];
        parts.push(renderPaginationItem("Trước", currentPage - 1, currentPage === 1, false));
        for (let p = from; p <= to; p++) {
            parts.push(renderPaginationItem(String(p), p, false, p === currentPage));
        }
        parts.push(renderPaginationItem("Sau", currentPage + 1, currentPage === totalPages, false));

        paginationEl.innerHTML = parts.join("");
        paginationNav.classList.remove("d-none");
    }

    function renderPaginationItem(label, page, disabled, active) {
        const classes = ["page-item"];
        if (disabled) classes.push("disabled");
        if (active) classes.push("active");
        return `<li class="${classes.join(" ")}">
            <button class="page-link history-page-link" type="button" data-page="${Number(page)}" ${
            disabled ? "disabled" : ""
        }>${escapeHtml(label)}</button>
        </li>`;
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
            setHistoryMessage("Không có lịch sử đặt bàn.", "text-muted");
            renderPagination(0);
            return;
        }

        const { pageItems, total } = getPageSlice(bookings);
        tableBody.innerHTML = pageItems
            .map((item) => {
                const date = formatDate(item.reservationTime);
                const statusKey = String(item.status || "").toUpperCase();
                const badgeClass = bookingStatusBadgeClass(statusKey);
                const statusVN = bookingStatusLabel(statusKey);
                return `
                <tr>
                    <td>${date}</td>
                    <td><b class="text-orange">Đặt bàn</b></td>
                    <td>${bookingRowSummary(item)}</td>
                    <td><span class="${badgeClass}">${escapeHtml(statusVN)}</span></td>
                    <td>
                        <button type="button" class="btn btn-outline-danger btn-sm px-3"
                            onclick="openBookingDetail(${item.id})">
                            Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>`;
            })
            .join("");
        setCardList(pageItems.map(bookingCardHtml).join(""));
        renderPagination(total);
    }

    function renderOrderRows(orders) {
        if (!orders || !orders.length) {
            setHistoryMessage("Không có đơn hàng.", "text-muted");
            renderPagination(0);
            return;
        }

        const { pageItems, total } = getPageSlice(orders);
        tableBody.innerHTML = pageItems
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
                    <td>${brief}</td>
                    <td><span class="${badgeClass}">${escapeHtml(st)}</span></td>
                    <td>
                        <button type="button" class="btn btn-outline-danger btn-sm px-3"
                            onclick="openOrderDetail(${o.id})">
                            Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                        </button>
                    </td>
                </tr>`;
            })
            .join("");
        setCardList(pageItems.map(orderCardHtml).join(""));
        renderPagination(total);
    }

    function renderMerged(bookings, orders) {
        const rows = [];
        (bookings || []).forEach((b) =>
            rows.push({ kind: "booking", ts: toTimestamp(b.reservationTime), booking: b })
        );
        (orders || []).forEach((o) => rows.push({ kind: "order", ts: toTimestamp(o.createdAt), order: o }));
        rows.sort((a, b) => b.ts - a.ts);

        if (!rows.length) {
            setHistoryMessage("Chưa có lịch sử.", "text-muted");
            renderPagination(0);
            return;
        }

        const { pageItems, total } = getPageSlice(rows);
        tableBody.innerHTML = pageItems
            .map((r) => {
                if (r.kind === "booking") {
                    const item = r.booking;
                    const date = formatDate(item.reservationTime);
                    const statusKey = String(item.status || "").toUpperCase();
                    const badgeClass = bookingStatusBadgeClass(statusKey);
                    const statusVN = bookingStatusLabel(statusKey);
                    return `
                    <tr>
                        <td>${date}</td>
                        <td><b class="text-orange">Đặt bàn</b></td>
                        <td>${bookingRowSummary(item)}</td>
                        <td><span class="${badgeClass}">${escapeHtml(statusVN)}</span></td>
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
                        <td>${brief}</td>
                        <td><span class="${badgeClass}">${escapeHtml(st)}</span></td>
                        <td>
                            <button type="button" class="btn btn-outline-danger btn-sm px-3"
                                onclick="openOrderDetail(${o.id})">
                                Xem <i class="fa-solid fa-chevron-right ms-1"></i>
                            </button>
                        </td>
                    </tr>`;
            })
            .join("");
        setCardList(
            pageItems
                .map((r) => (r.kind === "booking" ? bookingCardHtml(r.booking) : orderCardHtml(r.order)))
                .join("")
        );
        renderPagination(total);
    }

    function renderCurrentTabFromCache() {
        if (currentTab === "booking") {
            renderBookingRows(cachedBookings);
            return;
        }
        if (currentTab === "order") {
            renderOrderRows(cachedOrders);
            return;
        }
        renderMerged(cachedBookings, cachedOrders);
    }

    async function refresh() {
        showLoading();
        try {
            if (currentTab === "booking") {
                cachedBookings = await fetchBookings();
                renderBookingRows(cachedBookings);
            } else if (currentTab === "order") {
                cachedOrders = await fetchOrders();
                renderOrderRows(cachedOrders);
            } else {
                const [bookings, orders] = await Promise.all([fetchBookings(), fetchOrders()]);
                cachedBookings = bookings;
                cachedOrders = orders;
                renderMerged(cachedBookings, cachedOrders);
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
                    <p><b>Trạng thái:</b> <span class="${bookingStatusBadgeClass(item.status)}">${escapeHtml(
                bookingStatusLabel(item.status)
            )}</span></p>
                    ${
                        bookingStatusDescription(item.status)
                            ? `<p class="small text-muted border-start border-3 ps-3 mb-3">${escapeHtml(
                                  bookingStatusDescription(item.status)
                              )}</p>`
                            : ""
                    }
                    <p><b>Khách:</b> ${escapeHtml(item.customerName)}</p>
                    <p><b>SĐT:</b> ${escapeHtml(item.customerPhone)}</p>
                    <p><b>Thời gian:</b> ${formatDateTime(item.reservationTime)}</p>
                    <p><b>Số khách:</b> ${item.numberOfGuests}</p>
                    <p><b>Bàn:</b> ${item.tableNumber ? `${escapeHtml(item.tableNumber)}${item.tableLocation ? ` · ${escapeHtml(item.tableLocation)}` : ""}` : "Chờ xếp"}</p>
                    <p><b>Ghi chú:</b><br>${escapeHtml(item.note || "Không có")}</p>
                </div>`;

            const st = String(item.status || "").toUpperCase();
            if (st === "CONFIRMED" || st === "PENDING") {
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
        currentPage = 1;
        setFilterActive("all");
        refresh();
    });
    btnOrder.addEventListener("click", () => {
        currentTab = "order";
        currentPage = 1;
        setFilterActive("order");
        refresh();
    });
    btnBooking.addEventListener("click", () => {
        currentTab = "booking";
        currentPage = 1;
        setFilterActive("booking");
        refresh();
    });

    paginationEl?.addEventListener("click", (e) => {
        const btn = e.target.closest(".history-page-link[data-page]");
        if (!btn || btn.disabled) return;
        const next = Number(btn.dataset.page);
        if (!Number.isFinite(next) || next < 1 || next === currentPage) return;
        currentPage = next;
        renderCurrentTabFromCache();
    });

    // Mobile card list: delegate click + keyboard (Enter / Space) cho mỗi card item.
    if (cardList) {
        const openFromCard = (card) => {
            const id = Number(card.dataset.id);
            if (!Number.isFinite(id)) return;
            if (card.dataset.action === "booking") window.openBookingDetail(id);
            else if (card.dataset.action === "order") window.openOrderDetail(id);
        };
        cardList.addEventListener("click", (e) => {
            const card = e.target.closest(".history-card-item");
            if (card) openFromCard(card);
        });
        cardList.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const card = e.target.closest(".history-card-item");
            if (!card) return;
            e.preventDefault();
            openFromCard(card);
        });
    }

    setFilterActive("all");
    refresh();
});


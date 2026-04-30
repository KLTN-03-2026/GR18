const BASE_URL = "http://localhost:8080/api";
const token = localStorage.getItem("accessToken");

let allOrders = [];
let currentFilter = "ALL";
let lastPendingCount = 0;
let orderDetailModalInstance = null;
/** @type {"ACTIVE" | "HISTORY"} */
let viewMode = "ACTIVE";
let ordersPollTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!token) {
        window.location.href = "../dangnhap.html";
        return;
    }

    applyViewModeUi();
    bindViewModeButtons();
    bindFilterButtons();
    bindOrderTableRowOpens();
    initStaffWalkInModal();
    const modalEl = document.getElementById("order-detail-modal");
    if (modalEl && typeof bootstrap !== "undefined") {
        orderDetailModalInstance = new bootstrap.Modal(modalEl);
    }
    loadOrders();
    ordersPollTimer = setInterval(() => {
        if (viewMode === "ACTIVE") loadOrders({ silent: true });
    }, 10000);
});

function bindViewModeButtons() {
    document.querySelectorAll(".donhang-view-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.view;
            if (!next || next === viewMode) return;
            viewMode = next;
            document.querySelectorAll(".donhang-view-btn").forEach((b) => {
                b.classList.toggle("active", b.dataset.view === viewMode);
            });
            currentFilter = "ALL";
            document.querySelectorAll("#order-status-filters .btn-filter").forEach((b) => {
                b.classList.toggle("active", (b.dataset.filter || "ALL") === "ALL");
            });
            applyViewModeUi();
            if (viewMode === "ACTIVE") loadOrders();
            else loadOrderHistory();
        });
    });
}

function applyViewModeUi() {
    const filters = document.getElementById("order-status-filters");
    const thTime = document.getElementById("th-order-time-col");
    const secTitle = document.getElementById("order-table-section-title");
    const pageTitle = document.getElementById("donhang-page-title");
    if (viewMode === "HISTORY") {
        if (filters) filters.classList.add("d-none");
        if (thTime) thTime.textContent = "THANH TOÁN LÚC";
        if (secTitle) secTitle.textContent = "Đơn đã hoàn thành & đã thanh toán (gần đây)";
        if (pageTitle) pageTitle.textContent = "Lịch sử đơn hàng";
    } else {
        if (filters) filters.classList.remove("d-none");
        if (thTime) thTime.textContent = "ĐẶT LÚC";
        if (secTitle) secTitle.textContent = "Danh sách hóa đơn trực tiếp";
        if (pageTitle) pageTitle.textContent = "Đơn hàng";
    }
}

function bindOrderTableRowOpens() {
    const tbody = document.getElementById("order-table-body");
    if (!tbody) return;
    tbody.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const tr = e.target.closest("tr[data-order-id]");
        if (!tr) return;
        const raw = tr.getAttribute("data-order-id");
        if (raw == null || raw === "") return;
        const id = Number(raw);
        if (!Number.isFinite(id)) return;
        openOrderDetail(id);
    });
    tbody.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const tr = e.target.closest("tr[data-order-id]");
        if (!tr || !tr.classList.contains("order-row-open")) return;
        e.preventDefault();
        const raw = tr.getAttribute("data-order-id");
        if (!raw) return;
        openOrderDetail(Number(raw));
    });
}

function bindFilterButtons() {
    document.querySelectorAll("#order-status-filters .btn-filter").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#order-status-filters .btn-filter").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter || "ALL";
            renderTable();
        });
    });
}

async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        ...options
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
        throw new Error(json.message || `Lỗi ${res.status}`);
    }
    return json.data || [];
}

async function apiPost(path, bodyObj) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyObj)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
        throw new Error(json.message || `Lỗi ${res.status}`);
    }
    return json.data;
}

async function loadOrders(opts = {}) {
    const silent = opts.silent === true;
    try {
        const orders = await api("/staff/orders");
        const prevPending = lastPendingCount;
        allOrders = Array.isArray(orders) ? orders : [];
        const pending = allOrders.filter((o) => o.status === "PENDING").length;
        if (!silent && prevPending > 0 && pending > prevPending) {
            showAlert(`Có ${pending - prevPending} đơn mới vừa vào.`, "success");
        }
        lastPendingCount = pending;
        renderStats();
        renderTable();
    } catch (err) {
        if (!silent) showAlert(err.message || "Không tải được danh sách đơn.", "error");
    }
}

async function loadOrderHistory(opts = {}) {
    const silent = opts.silent === true;
    try {
        const orders = await api("/staff/orders/paid-recent?limit=120");
        allOrders = Array.isArray(orders) ? orders : [];
        renderStats();
        renderTable();
    } catch (err) {
        if (!silent) showAlert(err.message || "Không tải được lịch sử đơn.", "error");
    }
}

async function reloadCurrentOrderLists() {
    if (viewMode === "ACTIVE") await loadOrders();
    else await loadOrderHistory();
}

function renderStats() {
    const row = document.getElementById("order-stats-row");
    if (viewMode === "HISTORY") {
        if (row) row.classList.add("d-none");
        return;
    }
    if (row) row.classList.remove("d-none");
    const activeEl = document.getElementById("stat-active-orders");
    const pendingEl = document.getElementById("stat-new-orders");
    if (activeEl) activeEl.textContent = String(allOrders.length);
    if (pendingEl) pendingEl.textContent = String(allOrders.filter((o) => o.status === "PENDING").length);
}

function needsStaffPayment(order) {
    return order.paymentStatus === "UNPAID" && (order.status === "SERVING" || order.status === "COMPLETED");
}

function getFilteredOrders() {
    if (viewMode === "HISTORY") return allOrders;
    if (currentFilter === "ALL") return allOrders;
    if (currentFilter === "AWAIT_PAY") return allOrders.filter((o) => needsStaffPayment(o));
    return allOrders.filter((o) => o.status === currentFilter);
}

function renderTable() {
    const tbody = document.getElementById("order-table-body");
    const meta = document.getElementById("order-table-meta");
    if (!tbody) return;

    const rows = getFilteredOrders();
    if (!rows.length) {
        const emptyMsg =
            viewMode === "HISTORY"
                ? "Chưa có đơn đã thanh toán trong danh sách gần đây."
                : "Không có đơn phù hợp bộ lọc.";
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary">${emptyMsg}</td></tr>`;
        if (meta)
            meta.textContent =
                viewMode === "HISTORY" ? "Danh sách trống (tối đa 120 đơn mới nhất)." : "Không có đơn hàng cần xử lý.";
        return;
    }

    tbody.innerHTML = rows.map(renderRow).join("");
    if (meta) {
        if (viewMode === "HISTORY") {
            meta.textContent = `Hiển thị ${rows.length} đơn đã hoàn thành & đã thanh toán (mới nhất trước)`;
        } else {
            meta.textContent = `Đang hiển thị ${rows.length} trên ${allOrders.length} đơn đang xử lý`;
        }
    }
}

function renderRow(order) {
    const tableLabel = order.tableNumber || (order.tableId != null ? `Bàn ${order.tableId}` : "Bàn ?");
    const main = order.mainItem || "Món ăn";
    const extra = order.itemCount > 1 ? `+ ${order.itemCount - 1} món khác` : "Đơn 1 món";
    const timeRaw = viewMode === "HISTORY" ? order.paidAt : order.createdAt;
    const timeTitleAttr = escapeHtml(viewMode === "HISTORY" ? "Thời gian thanh toán" : "Thời gian khách đặt đơn");

    return `
        <tr class="order-row-open" data-order-id="${order.id}" role="button" tabindex="0" title="Click để xem chi tiết">
            <td class="ps-4">
                <div class="d-flex align-items-center gap-3">
                    <div class="table-id-box bg-primary-container text-primary">${escapeHtml(shortTable(tableLabel))}</div>
                    <span class="fw-bold">${escapeHtml(tableLabel)}</span>
                </div>
            </td>
            <td>
                <div class="item-summary">${escapeHtml(main)}</div>
                <div class="item-extra">${escapeHtml(extra)}</div>
            </td>
            <td class="text-light-emphasis">${escapeHtml(order.guestName || "Khách vãng lai")}</td>
            <td class="order-placed-cell small text-secondary text-nowrap" title="${timeTitleAttr}">${escapeHtml(
        formatDateTime(timeRaw)
    )}</td>
            <td class="fw-bold text-primary">${formatCurrency(order.totalAmount)}</td>
            <td><span class="badge-status ${statusClassForOrder(order)}">${orderStatusLabel(order)}</span></td>
            <td class="text-end pe-4" onclick="event.stopPropagation()" role="presentation">
                ${renderActionButtons(order)}
            </td>
        </tr>
    `;
}

function renderPaymentControls(orderId) {
    const payCash = `<button type="button" class="btn btn-settle" onclick="processStaffPayment(${orderId}, 'CASH')">Tiền mặt</button>`;
    const payQr = `<button type="button" class="btn btn-table-action" onclick="processStaffPayment(${orderId}, 'QR_CODE')">QR / CK</button>`;
    return `<div class="d-inline-flex flex-wrap gap-2 justify-content-end">${payCash}${payQr}</div>`;
}

function renderActionButtons(order) {
    if (viewMode === "HISTORY") {
        return `<span class="small text-muted">Chi tiết</span>`;
    }
    if (order.status === "PENDING") {
        return `<button class="btn btn-settle" onclick="updateOrderStatus(${order.id}, 'PREPARING')">Xác nhận & chuyển bếp</button>`;
    }
    if (order.status === "PREPARING") {
        return `<button class="btn btn-table-action" onclick="updateOrderStatus(${order.id}, 'SERVING')">Đánh dấu phục vụ</button>`;
    }
    if (needsStaffPayment(order)) {
        return renderPaymentControls(order.id);
    }
    return `<span class="small text-secondary">Không có thao tác</span>`;
}

async function processStaffPayment(orderId, method) {
    const label = method === "CASH" ? "tiền mặt" : "QR/chuyển khoản";
    if (!window.confirm(`Xác nhận đã thu (${label}) cho đơn #${orderId}?`)) return;
    try {
        await api(`/staff/orders/${orderId}/payment?method=${encodeURIComponent(method)}`, { method: "PATCH" });
        showAlert(`Đã thanh toán đơn #${orderId} (${label}). Đơn hoàn tất.`, "success");
        await reloadCurrentOrderLists();
    } catch (err) {
        showAlert(err.message || "Thu tiền thất bại.", "error");
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        await api(`/staff/orders/${orderId}/status?status=${encodeURIComponent(status)}`, { method: "PATCH" });
        showAlert(`Đã cập nhật đơn #${orderId} → ${translateStatusPlain(status)}.`, "success");
        await reloadCurrentOrderLists();
    } catch (err) {
        showAlert(err.message || "Cập nhật trạng thái thất bại.", "error");
    }
}

function showAlert(message, type) {
    const el = document.getElementById("order-alert");
    if (!el) return;
    el.className = `alert ${type === "error" ? "alert-danger" : "alert-success"} mb-3`;
    el.textContent = message;
    clearTimeout(showAlert._timer);
    showAlert._timer = setTimeout(() => {
        el.className = "d-none mb-3";
        el.textContent = "";
    }, 2500);
}

/** Nhãn hiển thị theo đơn (phân biệt COMPLETED nhưng chưa PAID). */
function orderStatusLabel(order) {
    if (order && order.status === "COMPLETED" && order.paymentStatus === "UNPAID") {
        return "Chờ thanh toán";
    }
    return translateStatusPlain(order && order.status);
}

function translateStatusPlain(status) {
    return {
        PENDING: "Đơn mới",
        PREPARING: "Đang chuẩn bị",
        SERVING: "Đang phục vụ",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy"
    }[status] || status || "Không rõ";
}

function statusClassForOrder(order) {
    if (order && order.status === "COMPLETED" && order.paymentStatus === "UNPAID") {
        return "bg-warning text-dark";
    }
    return statusClass(order && order.status);
}

function statusClass(status) {
    if (status === "PENDING") return "bg-error-container text-on-error";
    if (status === "PREPARING") return "bg-tertiary-container text-tertiary";
    if (status === "SERVING") return "bg-primary-container text-primary";
    return "bg-secondary-container text-on-secondary";
}

function formatCurrency(n) {
    return Number(n || 0).toLocaleString("vi-VN") + " VND";
}

function shortTable(label) {
    const m = String(label || "").match(/\d+/);
    return m ? `T-${m[0]}` : "T-?";
}

function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function openOrderDetail(orderId) {
    const modalEl = document.getElementById("order-detail-modal");
    let modalInst = orderDetailModalInstance;
    if (!modalInst && modalEl && typeof bootstrap !== "undefined") {
        orderDetailModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInst = orderDetailModalInstance;
    }
    if (!modalInst) return;
    const loading = document.getElementById("order-detail-loading");
    const bodyWrap = document.getElementById("order-detail-body");
    const titleEl = document.getElementById("orderDetailModalTitle");
    const metaEl = document.getElementById("order-detail-meta");

    if (titleEl) titleEl.textContent = `Đơn hàng #${orderId}`;
    if (metaEl) metaEl.textContent = "";

    resetOrderDetailFields();

    if (loading) {
        loading.classList.remove("d-none");
        bodyWrap && bodyWrap.classList.add("d-none");
    }

    modalInst.show();

    try {
        const detail = await fetchOrderDetail(orderId);
        if (loading) loading.classList.add("d-none");
        if (bodyWrap) bodyWrap.classList.remove("d-none");
        fillOrderDetailModal(detail, orderId);
    } catch (err) {
        if (loading) loading.classList.add("d-none");
        if (bodyWrap) bodyWrap.classList.remove("d-none");
        fillOrderDetailError(orderId, err.message || "Không tải được chi tiết.");
        showAlert(err.message || "Không tải được chi tiết đơn.", "error");
    }
}

async function fetchOrderDetail(orderId) {
    const res = await fetch(`${BASE_URL}/staff/orders/${encodeURIComponent(orderId)}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
        throw new Error(json.message || `Lỗi ${res.status}`);
    }
    return json.data;
}

function fillOrderDetailError(orderId, msg) {
    resetOrderDetailFields();
    const metaEl = document.getElementById("order-detail-meta");
    const titleEl = document.getElementById("orderDetailModalTitle");
    if (titleEl) {
        titleEl.textContent =
            orderId != null && String(orderId) !== ""
                ? `Đơn hàng #${orderId}`
                : "Chi tiết đơn";
    }
    if (metaEl) metaEl.textContent = typeof msg === "string" ? msg : "";
    const linesBody = document.getElementById("order-detail-lines-body");
    if (linesBody) {
        linesBody.innerHTML =
            `<tr><td colspan="4" class="ps-3 py-3 text-secondary">${escapeHtml(
                typeof msg === "string" ? msg : ""
            )}</td></tr>`;
    }
}

function resetOrderDetailFields() {
    setTextEl("detail-table", "—");
    setTextEl("detail-guest", "—");
    setTextEl("detail-note", "—");
    const badge = document.getElementById("detail-status-badge");
    if (badge) {
        badge.className = "badge-status bg-secondary-container text-on-secondary";
        badge.textContent = "—";
    }
    const payEl = document.getElementById("detail-payment");
    if (payEl) payEl.textContent = "—";
    setTextEl("detail-created", "—");
    const totalEl = document.getElementById("detail-total");
    if (totalEl) totalEl.textContent = "—";
}

function normalizeBackendDatetimeValue(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
        const s = raw.trim();
        const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/);
        if (m) return `${m[1]}T${m[2]}`;
        return s;
    }
    return raw;
}

function parseBackendDate(raw) {
    const v = normalizeBackendDatetimeValue(raw);
    if (v == null || v === "") return null;
    if (Array.isArray(v)) {
        const y = Number(v[0]);
        const mo = Number(v[1]);
        const d = Number(v[2]);
        const h = Number(v[3] != null ? v[3] : 0);
        const min = Number(v[4] != null ? v[4] : 0);
        const sec = Number(v[5] != null ? v[5] : 0);
        const dt = new Date(y, mo - 1, d, h, min, sec);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof v === "number") {
        const ms = v > 1e12 ? v : v * 1000;
        const dt = new Date(ms);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateTime(raw) {
    const d = parseBackendDate(raw);
    if (!d) return "—";
    return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function translatePayment(status, method, paidAt) {
    const s = {
        UNPAID: "Chưa thanh toán",
        PENDING: "Đang chờ thanh toán",
        PAID: "Đã thanh toán",
        FAILED: "Thanh toán thất bại",
        REFUNDED: "Đã hoàn tiền"
    }[status] || status || "—";
    const methods = {
        CASH: "Tiền mặt",
        CARD: "Thẻ",
        TRANSFER: "Chuyển khoản",
        MOMO: "Momo",
        VNPAY: "VNPay",
        EWALLET: "Ví điện tử",
        QR_CODE: "QR / chuyển khoản"
    };
    let out = escapeHtml(String(s));
    if (method) {
        out += `<br><span class="text-secondary">${escapeHtml(methods[method] || method)}</span>`;
    }
    if (paidAt && (status === "PAID" || status === "REFUNDED")) {
        out += `<br><span class="small text-muted">${escapeHtml(formatDateTime(paidAt).replace(/^—$/, "-"))}</span>`;
    }
    return out;
}

function fillOrderDetailModal(d, fallbackOrderId) {
    if (!d || typeof d !== "object") {
        fillOrderDetailError(fallbackOrderId, "Dữ liệu không hợp lệ.");
        return;
    }

    const titleEl = document.getElementById("orderDetailModalTitle");
    const metaEl = document.getElementById("order-detail-meta");
    const tableLbl = d.tableNumber || (d.tableId != null ? `Bàn ${d.tableId}` : "—");

    if (titleEl) titleEl.textContent = `Đơn hàng #${d.id}`;
    if (metaEl) metaEl.textContent = `#${d.id}`;

    setTextEl("detail-table", tableLbl);
    setTextEl("detail-guest", d.guestName || "Khách vãng lai");

    const badge = document.getElementById("detail-status-badge");
    if (badge) {
        const summary = { status: d.status, paymentStatus: d.paymentStatus };
        badge.className = `badge-status ${statusClassForOrder(summary)}`;
        badge.textContent = orderStatusLabel(summary);
    }

    const payEl = document.getElementById("detail-payment");
    if (payEl) payEl.innerHTML = translatePayment(d.paymentStatus, d.paymentMethod, d.paidAt);

    setTextEl("detail-created", formatDateTime(d.createdAt));

    const noteTxt = (d.note && String(d.note).trim()) || "Không có";
    setHtmlEl("detail-note", escapeHtml(noteTxt));

    const totalEl = document.getElementById("detail-total");
    if (totalEl) totalEl.textContent = formatCurrency(d.totalAmount);

    const linesBody = document.getElementById("order-detail-lines-body");
    const items = Array.isArray(d.items) ? d.items : [];
    if (linesBody) {
        if (!items.length) {
            linesBody.innerHTML =
                `<tr><td colspan="4" class="text-center py-4 text-secondary">Không có dòng món.</td></tr>`;
        } else {
            linesBody.innerHTML = items
                .map((line) => {
                    const name = escapeHtml(line.itemName || "Món");
                    const qty = Number(line.quantity) || 0;
                    const unit = formatCurrency(line.unitPrice);
                    const sub = formatCurrency(line.subtotal);
                    const n = line.note && String(line.note).trim()
                        ? `<div class="line-note mt-1"><span class="material-symbols-outlined align-middle text-secondary me-1" style="font-size:0.95rem;line-height:1;vertical-align:-2px;">edit_note</span>${escapeHtml(line.note)}</div>`
                        : "";
                    return `<tr>
              <td class="ps-3">${name}${n}</td>
              <td class="text-center">${qty}</td>
              <td class="text-end">${unit}</td>
              <td class="text-end pe-3">${sub}</td>
            </tr>`;
                })
                .join("");
        }
    }
}

function setTextEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text == null || text === "" ? "—" : text;
}

function setHtmlEl(id, htmlTrustedLiteralsFromEscape) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = htmlTrustedLiteralsFromEscape;
}

/* ——— Nhân viên tạo đơn gắn bàn ——— */
let staffMenuOptionsHtml = "";
let staffWalkInBootstrapModal = null;

function initStaffWalkInModal() {
    const openBtn = document.getElementById("btn-open-staff-order");
    const modalEl = document.getElementById("staff-create-order-modal");
    const addBtn = document.getElementById("staff-add-line");
    const submitBtn = document.getElementById("staff-order-submit");
    const tbody = document.getElementById("staff-order-lines-body");

    const Bs = typeof window !== "undefined" ? window.bootstrap : undefined;
    if (!openBtn || !modalEl || !Bs || !Bs.Modal) {
        if (typeof console !== "undefined" && console.warn) {
            console.warn("Không khởi tạo form tạo đơn: thiếu nút/modal hoặc bootstrap.");
        }
        return;
    }
    staffWalkInBootstrapModal =
        typeof Bs.Modal.getOrCreateInstance === "function"
            ? Bs.Modal.getOrCreateInstance(modalEl)
            : new Bs.Modal(modalEl);

    openBtn.addEventListener("click", async () => {
        resetStaffOrderForm();
        staffWalkInBootstrapModal.show();
        try {
            await ensureStaffWalkInChoices();
            syncStaffLineMenuDropdownsAfterChoicesLoad();
        } catch (_e) {
            showAlert("Không tải được danh sách bàn hoặc menu. Kiểm tra kết nối và đăng nhập nhân viên.", "error");
        }
    });

    modalEl.addEventListener("shown.bs.modal", () => {
        const g = document.getElementById("staff-order-guest");
        if (g) g.focus();
    });

    if (addBtn) addBtn.addEventListener("click", () => addStaffOrderLine());

    if (tbody) {
        tbody.addEventListener("click", (e) => {
            const rm = e.target.closest(".staff-line-remove");
            if (!rm) return;
            const tr = rm.closest("tr");
            const n = tbody.querySelectorAll("tr").length;
            if (tr && n > 1) tr.remove();
        });
    }

    if (submitBtn) submitBtn.addEventListener("click", submitStaffWalkInOrder);
}

async function ensureStaffWalkInChoices() {
    const sel = document.getElementById("staff-order-table");
    if (!sel) return;

    const tables = await api("/tables/staff/tables");
    const list = Array.isArray(tables) ? tables : [];
    const active = list.filter((t) => t.isActive !== false && t.id != null);
    sel.innerHTML =
        `<option value="">${escapeHtml("— Chọn bàn —")}</option>` +
        active
            .map(function (t) {
                const num = escapeHtml(String(t.tableNumber != null ? t.tableNumber : "Bàn " + t.id));
                const st = escapeHtml(String(t.status != null ? t.status : ""));
                return `<option value="${Number(t.id)}">${num}${st ? " · " + st : ""}</option>`;
            })
            .join("");

    const resMenu = await fetch(`${BASE_URL}/menu`);
    const jsonMenu = await resMenu.json().catch(() => ({}));
    const menu = Array.isArray(jsonMenu.data) ? jsonMenu.data : [];
    staffMenuOptionsHtml =
        `<option value="">${escapeHtml("— Chọn món —")}</option>` +
        menu
            .map(function (m) {
                const name = escapeHtml(String(m.name != null ? m.name : ""));
                let priceLabel = "";
                try {
                    if (m.price != null && !Number.isNaN(Number(m.price))) {
                        priceLabel =
                            " — " +
                            Number(m.price).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) +
                            "\u202fđ";
                    }
                } catch (_) {
                    priceLabel = "";
                }
                return `<option value="${Number(m.id)}">${name}${priceLabel}</option>`;
            })
            .join("");

    if (!menu.length) {
        staffMenuOptionsHtml =
            `<option value="">${escapeHtml("Không có món — kiểm tra menu hệ thống")}</option>`;
    }
}

function syncStaffLineMenuDropdownsAfterChoicesLoad() {
    const html =
        staffMenuOptionsHtml && staffMenuOptionsHtml.length
            ? staffMenuOptionsHtml
            : `<option value="">${escapeHtml("—")}</option>`;
    document.querySelectorAll("#staff-order-lines-body .staff-line-menu").forEach((sel) => {
        const prev = sel.value;
        sel.innerHTML = html;
        if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    });
}

function resetStaffOrderForm() {
    const guestField = document.getElementById("staff-order-guest");
    const noteField = document.getElementById("staff-order-note");
    const tbody = document.getElementById("staff-order-lines-body");
    if (guestField) guestField.value = "Khách tại chỗ";
    if (noteField) noteField.value = "";
    if (tbody) {
        tbody.innerHTML = "";
        addStaffOrderLine();
    }
}

function addStaffOrderLine() {
    const tbody = document.getElementById("staff-order-lines-body");
    if (!tbody) return;
    const inner =
        staffMenuOptionsHtml && staffMenuOptionsHtml.length ? staffMenuOptionsHtml : `<option value="">—</option>`;
    tbody.insertAdjacentHTML("beforeend", buildStaffOrderLineRow(inner));
}

function buildStaffOrderLineRow(innerOptionsHtml) {
    return `<tr>` +
        `<td class="ps-2 pt-2"><select class="form-select form-select-sm rounded-3 staff-line-menu" required>${innerOptionsHtml}</select></td>` +
        `<td class="pt-2"><input type="number" min="1" step="1" value="1" class="form-control form-control-sm rounded-3 staff-line-qty" required /></td>` +
        `<td class="pt-2"><input type="text" class="form-control form-control-sm rounded-3 staff-line-note" maxlength="200" placeholder="Tuỳ chọn món" /></td>` +
        `<td class="text-end align-middle pe-2"><button type="button" class="btn btn-link text-danger btn-sm py-0 staff-line-remove" title="Xóa">&times;</button></td>` +
        `</tr>`;
}

async function submitStaffWalkInOrder() {
    const tableSel = document.getElementById("staff-order-table");
    const submitBtn = document.getElementById("staff-order-submit");
    const guestEl = document.getElementById("staff-order-guest");
    const noteEl = document.getElementById("staff-order-note");

    const tableIdRaw = tableSel && tableSel.value ? tableSel.value : "";
    const tableIdNum = Number(tableIdRaw);
    const guestName = guestEl ? guestEl.value.trim() : "";

    if (!tableIdRaw || !Number.isFinite(tableIdNum) || tableIdNum <= 0) {
        showAlert("Vui lòng chọn bàn.", "error");
        return;
    }
    if (!guestName) {
        showAlert("Vui lòng nhập tên khách.", "error");
        return;
    }

    const rows = [...document.querySelectorAll("#staff-order-lines-body tr")];
    /** @type {{ menuItemId: number; quantity: number; note: string | null }[]} */
    const items = [];

    for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const menuEl = tr.querySelector(".staff-line-menu");
        const qtyEl = tr.querySelector(".staff-line-qty");
        const lnEl = tr.querySelector(".staff-line-note");
        const midRaw = menuEl ? menuEl.value : "";
        const qty = qtyEl ? Number(qtyEl.value) : NaN;
        const ln = lnEl ? String(lnEl.value || "").trim() : "";
        if (!midRaw) continue;
        if (!qty || qty < 1) {
            showAlert("Số lượng mỗi dòng đã chọn món phải ≥ 1.", "error");
            return;
        }
        items.push({
            menuItemId: Number(midRaw),
            quantity: Math.floor(qty),
            note: ln ? ln : null
        });
    }

    if (!items.length) {
        showAlert("Chọn ít nhất một món trong đơn.", "error");
        return;
    }

    const noteOrder = noteEl ? String(noteEl.value || "").trim() : "";

    let prevDisabled = false;
    if (submitBtn) {
        prevDisabled = submitBtn.disabled;
        submitBtn.disabled = true;
    }

    try {
        await apiPost("/staff/table-orders", {
            tableId: tableIdNum,
            guestName: guestName,
            note: noteOrder.length ? noteOrder : null,
            items: items
        });
        showAlert("Đã tạo đơn và gắn bàn.", "success");
        if (staffWalkInBootstrapModal) staffWalkInBootstrapModal.hide();
        await reloadCurrentOrderLists();
    } catch (err) {
        showAlert(err.message || "Gửi đơn thất bại.", "error");
    } finally {
        if (submitBtn) submitBtn.disabled = prevDisabled;
    }
}
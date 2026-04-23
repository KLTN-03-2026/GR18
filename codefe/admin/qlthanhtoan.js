const BASE_URL = "http://localhost:8080/api";
const token = localStorage.getItem("accessToken");

let unpaidOrders = [];
let paidHistory = [];
let paymentListFilter = "ALL";
let pendingPaymentOrderId = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!token) {
        window.location.href = "../dangnhap.html";
        return;
    }

    document.querySelectorAll(".payment-filter").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".payment-filter").forEach((b) => {
                b.classList.remove("active", "btn-surface-high", "text-white");
                b.classList.add("text-secondary");
            });
            btn.classList.add("active", "btn-surface-high", "text-white");
            btn.classList.remove("text-secondary");
            paymentListFilter = btn.dataset.filter || "ALL";
            renderUnpaidList();
        });
    });

    document.getElementById("btn-refresh-payments")?.addEventListener("click", loadPaymentPageData);
    document.getElementById("btn-confirm-payment-submit")?.addEventListener("click", submitConfirmPayment);

    loadPaymentPageData();
    setInterval(loadPaymentPageData, 20000);
});

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
    return json.data;
}

async function loadPaymentPageData() {
    try {
        const [unpaid, history, revMap] = await Promise.all([
            api("/staff/payments/unpaid?limit=100"),
            api("/staff/payments/history?limit=50"),
            api("/staff/payments/today-revenue")
        ]);
        unpaidOrders = Array.isArray(unpaid) ? unpaid : [];
        paidHistory = Array.isArray(history) ? history : [];
        const todayRev = revMap && revMap.todayRevenue != null ? Number(revMap.todayRevenue) : 0;

        const cntEl = document.getElementById("stat-unpaid-count");
        const revEl = document.getElementById("stat-today-revenue");
        if (cntEl) cntEl.textContent = String(unpaidOrders.length);
        if (revEl) revEl.textContent = formatCurrencyShort(todayRev);

        renderUnpaidList();
        renderHistoryList();
        showPageAlert("", null);
    } catch (err) {
        showPageAlert(err.message || "Không tải được dữ liệu thanh toán.", "error");
    }
}

function getFilteredUnpaid() {
    if (paymentListFilter === "SERVING") {
        return unpaidOrders.filter((o) => o.status === "SERVING");
    }
    return unpaidOrders;
}

function renderUnpaidList() {
    const root = document.getElementById("unpaid-invoices-list");
    if (!root) return;

    const rows = getFilteredUnpaid();
    if (!rows.length) {
        root.innerHTML =
            '<p class="text-secondary py-4 text-center mb-0">Không có hóa đơn chưa thanh toán trong danh sách này.</p>';
        return;
    }

    root.innerHTML = rows.map(renderUnpaidCard).join("");
}

function renderUnpaidCard(order) {
    const tableLabel = order.tableNumber != null ? `BÀN ${order.tableNumber}` : order.tableId != null ? `BÀN #${order.tableId}` : "BÀN ?";
    const guest = order.guestName || "Khách vãng lai";
    const main = order.mainItem || "Món";
    const extra = order.itemCount > 1 ? ` +${order.itemCount - 1} món` : "";
    const when = formatDateTime(order.createdAt);
    const st = translateOrderStatus(order.status);
    const suggest =
        order.status === "SERVING"
            ? `<span class="material-symbols-outlined fs-6 align-middle">restaurant</span><span class="smaller fw-bold text-uppercase ms-1">Sẵn sàng thu</span>`
            : `<span class="pulse-dot-secondary d-inline-block align-middle"></span><span class="smaller fw-bold text-secondary text-uppercase ms-1">Đơn đang xử lý</span>`;

    return `
        <div class="invoice-card p-4 rounded-4 mb-4 border border-outline-variant/10 shadow-sm" data-order-id="${order.id}">
            <div class="d-flex flex-column flex-md-row align-items-center gap-4">
                <div class="table-badge-wrapper">
                    <span class="badge bg-tertiary-container text-on-tertiary px-3 py-2 rounded-3 fw-bold">${escapeHtml(tableLabel)}</span>
                </div>
                <div class="flex-grow-1 text-center text-md-start">
                    <h5 class="fw-bold mb-1">Đơn #${order.id}</h5>
                    <p class="smaller text-secondary mb-0">${escapeHtml(guest)} • ${escapeHtml(main)}${escapeHtml(extra)}</p>
                    <p class="smaller text-secondary mb-0">Tạo: ${escapeHtml(when)} • <span class="badge bg-secondary-container-soft text-secondary">${escapeHtml(st)}</span></p>
                </div>
                <div class="text-md-end">
                    <h4 class="fw-800 mb-0 text-white">${formatCurrency(order.totalAmount)}</h4>
                    <div class="d-flex align-items-center gap-2 justify-content-md-end mt-1">${suggest}</div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-top border-outline-variant/10 d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-primary flex-grow-1 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2" onclick="openPaymentConfirm(${order.id})">
                    <span class="material-symbols-outlined fs-5">check_circle</span> Xác nhận thanh toán
                </button>
                <button type="button" class="btn btn-surface-high rounded-pill px-3" onclick="showPaymentDetail(${order.id})" title="Chi tiết">
                    <span class="material-symbols-outlined fs-5">receipt_long</span>
                </button>
            </div>
        </div>
    `;
}

function renderHistoryList() {
    const root = document.getElementById("payment-history-list");
    if (!root) return;

    if (!paidHistory.length) {
        root.innerHTML = '<p class="text-secondary small mb-0">Chưa có giao dịch gần đây.</p>';
        return;
    }

    root.innerHTML = paidHistory.map(renderHistoryItem).join("");
}

function renderHistoryItem(order) {
    const tablePart =
        order.tableNumber != null ? `Bàn ${order.tableNumber}` : order.tableId != null ? `Bàn #${order.tableId}` : "—";
    const method = paymentMethodLabel(order.paymentMethod);
    const when = formatTime(order.paidAt || order.createdAt);
    const icon = order.paymentMethod === "QR_CODE" ? "qr_code" : "payments";

    return `
        <div class="history-item d-flex align-items-center justify-content-between p-3 rounded-4 mb-3">
            <div class="d-flex align-items-center gap-3">
                <div class="icon-box bg-secondary-soft text-secondary">
                    <span class="material-symbols-outlined">${icon}</span>
                </div>
                <div>
                    <p class="mb-0 fw-bold small">Đơn #${order.id} (${escapeHtml(tablePart)})</p>
                    <p class="mb-0 text-secondary smaller">${escapeHtml(method)} • ${escapeHtml(when)}</p>
                </div>
            </div>
            <div class="text-end">
                <p class="mb-0 fw-bold small">${formatCurrency(order.totalAmount)}</p>
                <span class="badge bg-secondary-container-soft text-secondary smaller px-2 py-1 rounded-pill">ĐÃ THU</span>
            </div>
        </div>
    `;
}

function openPaymentConfirm(orderId) {
    pendingPaymentOrderId = orderId;
    const order = unpaidOrders.find((o) => Number(o.id) === Number(orderId));
    const sumEl = document.getElementById("payment-confirm-summary");
    const titleEl = document.getElementById("payment-confirm-title");
    if (titleEl) titleEl.textContent = `Xác nhận thanh toán · Đơn #${orderId}`;
    if (sumEl && order) {
        const tablePart =
            order.tableNumber != null ? `Bàn ${order.tableNumber}` : order.tableId != null ? `#${order.tableId}` : "?";
        sumEl.textContent = `${order.guestName || "Khách"} · ${tablePart} · ${formatCurrency(order.totalAmount)}`;
    } else if (sumEl) {
        sumEl.textContent = `Đơn #${orderId}`;
    }
    const cash = document.getElementById("pay-cash");
    if (cash) cash.checked = true;
    const modalEl = document.getElementById("payment-confirm-modal");
    if (modalEl && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

async function submitConfirmPayment() {
    if (pendingPaymentOrderId == null) return;
    const methodEl = document.querySelector('input[name="paymentMethod"]:checked');
    const method = methodEl ? methodEl.value : "CASH";
    const btn = document.getElementById("btn-confirm-payment-submit");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Đang xử lý…";
    }
    try {
        await api(`/staff/orders/${pendingPaymentOrderId}/payment?method=${encodeURIComponent(method)}`, {
            method: "PATCH"
        });
        const modalEl = document.getElementById("payment-confirm-modal");
        if (modalEl && window.bootstrap) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
        }
        pendingPaymentOrderId = null;
        showPageAlert("Đã ghi nhận thanh toán.", "success");
        await loadPaymentPageData();
    } catch (err) {
        showPageAlert(err.message || "Thanh toán thất bại.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Xác nhận đã thu";
        }
    }
}

async function showPaymentDetail(orderId) {
    const bodyEl = document.getElementById("payment-detail-body");
    const titleEl = document.getElementById("payment-detail-title");
    if (titleEl) titleEl.textContent = `Chi tiết đơn #${orderId}`;
    if (bodyEl) bodyEl.innerHTML = '<p class="text-muted mb-0">Đang tải…</p>';
    try {
        const d = await api(`/staff/orders/${orderId}`);
        if (bodyEl) bodyEl.innerHTML = renderDetailBody(d);
        const modalEl = document.getElementById("payment-detail-modal");
        if (modalEl && window.bootstrap) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    } catch (err) {
        if (bodyEl) bodyEl.innerHTML = "";
        showPageAlert(err.message || "Không tải chi tiết.", "error");
    }
}

function renderDetailBody(d) {
    const items = Array.isArray(d.items) ? d.items : [];
    const rows = items
        .map((it) => {
            const note = it.note ? `<div class="small text-muted">${escapeHtml(it.note)}</div>` : "";
            return `<tr><td><div class="fw-semibold">${escapeHtml(it.itemName || "Món")}</div>${note}</td>
                <td class="text-center">${it.quantity != null ? it.quantity : "—"}</td>
                <td class="text-end">${formatCurrency(it.unitPrice)}</td>
                <td class="text-end fw-semibold">${formatCurrency(it.subtotal)}</td></tr>`;
        })
        .join("");
    const noteBlock =
        d.note && String(d.note).trim()
            ? `<div class="mb-3"><span class="text-muted small">Ghi chú:</span><div class="border rounded p-2 small bg-light text-dark">${escapeHtml(d.note).replace(/\n/g, "<br>")}</div></div>`
            : "";
    return `<p class="small text-muted mb-2">${escapeHtml(translateOrderStatus(d.status))} · TT: ${escapeHtml(paymentStatusLabel(d.paymentStatus))}</p>
        ${noteBlock}
        <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Món</th><th class="text-center">SL</th><th class="text-end">Đơn giá</th><th class="text-end">Tạm tính</th></tr></thead><tbody>
        ${rows || '<tr><td colspan="4" class="text-secondary">Không có món.</td></tr>'}
        </tbody></table></div>
        <p class="text-end fs-5 fw-bold mb-0">${formatCurrency(d.totalAmount)}</p>`;
}

function showPageAlert(message, type) {
    const el = document.getElementById("payment-page-alert");
    if (!el) return;
    if (!message) {
        el.className = "d-none mb-3";
        el.textContent = "";
        return;
    }
    el.className = `alert ${type === "error" ? "alert-danger" : "alert-success"} mb-3`;
    el.textContent = message;
    clearTimeout(showPageAlert._t);
    showPageAlert._t = setTimeout(() => {
        el.className = "d-none mb-3";
        el.textContent = "";
    }, 3200);
}

function translateOrderStatus(status) {
    return (
        {
            PENDING: "Đơn mới",
            PREPARING: "Đang chuẩn bị",
            SERVING: "Đang phục vụ",
            COMPLETED: "Hoàn thành",
            CANCELLED: "Đã hủy"
        }[status] || status || "—"
    );
}

function paymentStatusLabel(ps) {
    if (ps === "PAID") return "Đã thanh toán";
    if (ps === "UNPAID") return "Chưa thanh toán";
    return ps || "—";
}

function paymentMethodLabel(m) {
    return { CASH: "Tiền mặt", QR_CODE: "QR / CK" }[m] || m || "—";
}

function formatCurrency(n) {
    return Number(n || 0).toLocaleString("vi-VN") + " đ";
}

function formatCurrencyShort(n) {
    const v = Number(n || 0);
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + " tỷ";
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "tr";
    if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
    return v.toLocaleString("vi-VN") + " đ";
}

function formatDateTime(raw) {
    if (raw == null) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatTime(raw) {
    if (raw == null) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const BASE_URL = "http://localhost:8080/api";
const token = localStorage.getItem("accessToken");

let allOrders = [];
let currentFilter = "ALL";
let lastPendingCount = 0;

document.addEventListener("DOMContentLoaded", () => {
    if (!token) {
        window.location.href = "../dangnhap.html";
        return;
    }

    bindFilterButtons();
    loadOrders();
    setInterval(loadOrders, 10000);
});

function bindFilterButtons() {
    document.querySelectorAll(".btn-filter").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-filter").forEach((b) => b.classList.remove("active"));
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

async function loadOrders() {
    try {
        const orders = await api("/staff/orders");
        const prevPending = lastPendingCount;
        allOrders = Array.isArray(orders) ? orders : [];
        const pending = allOrders.filter((o) => o.status === "PENDING").length;
        if (prevPending > 0 && pending > prevPending) {
            showAlert(`Có ${pending - prevPending} đơn mới vừa vào.`, "success");
        }
        lastPendingCount = pending;
        renderStats();
        renderTable();
    } catch (err) {
        showAlert(err.message || "Không tải được danh sách đơn.", "error");
    }
}

function renderStats() {
    const activeEl = document.getElementById("stat-active-orders");
    const pendingEl = document.getElementById("stat-new-orders");
    if (activeEl) activeEl.textContent = String(allOrders.length);
    if (pendingEl) pendingEl.textContent = String(allOrders.filter((o) => o.status === "PENDING").length);
}

function getFilteredOrders() {
    if (currentFilter === "ALL") return allOrders;
    return allOrders.filter((o) => o.status === currentFilter);
}

function renderTable() {
    const tbody = document.getElementById("order-table-body");
    const meta = document.getElementById("order-table-meta");
    if (!tbody) return;

    const rows = getFilteredOrders();
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-secondary">Không có đơn phù hợp bộ lọc.</td></tr>`;
        if (meta) meta.textContent = "Không có đơn hàng cần xử lý.";
        return;
    }

    tbody.innerHTML = rows.map(renderRow).join("");
    if (meta) meta.textContent = `Đang hiển thị ${rows.length} trên ${allOrders.length} đơn hoạt động`;
}

function renderRow(order) {
    const tableLabel = order.tableNumber || (order.tableId != null ? `Bàn ${order.tableId}` : "Bàn ?");
    const main = order.mainItem || "Món ăn";
    const extra = order.itemCount > 1 ? `+ ${order.itemCount - 1} món khác` : "Đơn 1 món";

    return `
        <tr>
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
            <td class="fw-bold text-primary">${formatCurrency(order.totalAmount)}</td>
            <td><span class="badge-status ${statusClass(order.status)}">${translateStatus(order.status)}</span></td>
            <td class="text-end pe-4">
                ${renderActionButtons(order)}
            </td>
        </tr>
    `;
}

function renderActionButtons(order) {
    if (order.status === "PENDING") {
        return `<button class="btn btn-settle" onclick="updateOrderStatus(${order.id}, 'PREPARING')">Xác nhận & chuyển bếp</button>`;
    }
    if (order.status === "PREPARING") {
        return `<button class="btn btn-table-action" onclick="updateOrderStatus(${order.id}, 'SERVING')">Đánh dấu phục vụ</button>`;
    }
    if (order.status === "SERVING") {
        return `<button class="btn btn-table-action" onclick="updateOrderStatus(${order.id}, 'COMPLETED')">Hoàn tất đơn</button>`;
    }
    return `<span class="small text-secondary">Không có thao tác</span>`;
}

async function updateOrderStatus(orderId, status) {
    try {
        await api(`/staff/orders/${orderId}/status?status=${encodeURIComponent(status)}`, { method: "PATCH" });
        showAlert(`Đã cập nhật đơn #${orderId} -> ${translateStatus(status)}.`, "success");
        await loadOrders();
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

function translateStatus(status) {
    return {
        PENDING: "Đơn mới",
        PREPARING: "Đang chuẩn bị",
        SERVING: "Đang phục vụ",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy"
    }[status] || status || "Không rõ";
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
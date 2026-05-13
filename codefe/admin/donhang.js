const BASE_URL = "http://localhost:8080/api";
const token = localStorage.getItem("accessToken");

let allOrders = [];
let currentFilter = "ALL";
let lastPendingCount = 0;
let orderDetailModalInstance = null;
/** @type {"ACTIVE" | "HISTORY"} */
let viewMode = "ACTIVE";
let ordersPollTimer = null;
const HISTORY_PAGE_SIZE = 10;
let historyCurrentPage = 1;

/** Menu cho form tạo đơn gắn bàn (ô tìm + gợi ý; nameNorm / categoryLabel) */
/** @type {{ id: number; name: string; price: number | null; nameNorm: string; categoryLabel: string }[]} */
let staffWalkInMenuItems = [];

/** Hiển thị trạng thái bàn (API trả enum tiếng Anh) → tiếng Việt */
const TABLE_STATUS_VI = {
    AVAILABLE: "Trống",
    OCCUPIED: "Đang dùng",
    RESERVED: "Đã đặt",
    CLEANING: "Đang dọn"
};

function formatTableStatusVi(raw) {
    if (raw == null) return "";
    const key = String(raw).trim().toUpperCase();
    return TABLE_STATUS_VI[key] || String(raw).trim();
}

function normalizeStaffMenuQuery(s) {
    return String(s || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
}

const STAFF_MENU_SUGGEST_MAX = 22;

function cancelStaffSuggestFrame(ul) {
    if (!ul || !ul._staffMenuRaf) return;
    cancelAnimationFrame(ul._staffMenuRaf);
    ul._staffMenuRaf = null;
}

/** Gộp nhiều sự kiện input trong cùng một khung hình (giảm jank khi gõ). */
function scheduleStaffSuggestRender(ul, query) {
    if (!ul) return;
    cancelStaffSuggestFrame(ul);
    ul._staffMenuRaf = requestAnimationFrame(function () {
        ul._staffMenuRaf = null;
        renderStaffMenuSuggestions(ul, query);
    });
}

function renderStaffMenuSuggestions(ul, query) {
    if (!ul) return;
    ul.innerHTML = "";
    if (!staffWalkInMenuItems.length) {
        const empty = document.createElement("li");
        empty.className = "list-group-item py-2 px-2 small text-muted border-0";
        empty.textContent = "Chưa có dữ liệu menu.";
        ul.appendChild(empty);
        ul.classList.remove("d-none");
        return;
    }
    const q = normalizeStaffMenuQuery(query);
    let list = staffWalkInMenuItems;
    if (q) {
        list = staffWalkInMenuItems.filter(function (m) {
            return m.nameNorm.includes(q);
        });
    } else {
        list = staffWalkInMenuItems.slice(0, STAFF_MENU_SUGGEST_MAX);
    }
    const show = list.slice(0, STAFF_MENU_SUGGEST_MAX);
    show.forEach(function (m) {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action py-2 px-2 small staff-menu-suggest-item";
        li.setAttribute("role", "option");
        li.dataset.id = String(m.id);
        let label = m.name;
        if (m.price != null && Number.isFinite(Number(m.price))) {
            label +=
                " — " +
                Number(m.price).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) +
                "\u202fđ";
        }
        li.textContent = label;
        ul.appendChild(li);
    });
    if (q && !list.length) {
        const none = document.createElement("li");
        none.className = "list-group-item py-2 px-2 small text-muted border-0";
        none.textContent = "Không tìm thấy món phù hợp.";
        ul.appendChild(none);
    } else if (q && list.length > STAFF_MENU_SUGGEST_MAX) {
        const more = document.createElement("li");
        more.className = "list-group-item py-1 px-2 smaller text-muted border-0";
        more.textContent =
            "… còn " + (list.length - STAFF_MENU_SUGGEST_MAX) + " món — gõ thêm ký tự để lọc chính xác hơn.";
        ul.appendChild(more);
    }
    ul.classList.remove("d-none");
}

function hideAllStaffMenuSuggests() {
    document.querySelectorAll("#staff-order-lines-body .staff-menu-suggest").forEach(function (ul) {
        cancelStaffSuggestFrame(ul);
        ul.classList.add("d-none");
        ul.innerHTML = "";
    });
}

function hideAllStaffMenuPanels() {
    document.querySelectorAll("#staff-order-lines-body .staff-menu-panel").forEach(function (panel) {
        panel.classList.add("d-none");
    });
    document.querySelectorAll("#staff-order-lines-body .staff-menu-panel-toggle").forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
    });
}

function cancelStaffPanelFrame(wrap) {
    if (!wrap || !wrap._staffPanelRaf) return;
    cancelAnimationFrame(wrap._staffPanelRaf);
    wrap._staffPanelRaf = null;
}

function scheduleStaffPanelRender(wrap) {
    if (!wrap) return;
    cancelStaffPanelFrame(wrap);
    wrap._staffPanelRaf = requestAnimationFrame(function () {
        wrap._staffPanelRaf = null;
        renderStaffFullMenuPanel(wrap);
    });
}

function hideStaffMenuPanelSingle(wrap) {
    if (!wrap) return;
    const panel = wrap.querySelector(".staff-menu-panel");
    const btn = wrap.querySelector(".staff-menu-panel-toggle");
    if (panel) panel.classList.add("d-none");
    if (btn) btn.setAttribute("aria-expanded", "false");
}

/** @returns {HTMLElement | null} */
function staffWalkInClosestComboWrap(el) {
    const w = el && el.closest && el.closest(".staff-menu-combo-wrap");
    var body = document.getElementById("staff-order-lines-body");
    return w && body && body.contains(w) ? w : null;
}

function applyStaffWalkInMenuPick(wrap, id) {
    if (!wrap || id == null || id === "") return;
    const hid = wrap.querySelector(".staff-line-menu-id");
    const inp = wrap.querySelector(".staff-line-menu-search");
    const ul = wrap.querySelector(".staff-menu-suggest");
    const m = staffWalkInMenuItems.find(function (x) {
        return String(x.id) === String(id);
    });
    if (hid) hid.value = String(id);
    if (inp && m) inp.value = m.name;
    if (ul) {
        cancelStaffSuggestFrame(ul);
        ul.classList.add("d-none");
        ul.innerHTML = "";
    }
    cancelStaffPanelFrame(wrap);
    hideStaffMenuPanelSingle(wrap);
}

function getStaffWalkInSortedCategories() {
    var set = new Set();
    for (var i = 0; i < staffWalkInMenuItems.length; i++) {
        var m = staffWalkInMenuItems[i];
        var c =
            typeof m.categoryLabel === "string" && m.categoryLabel.trim().length
                ? m.categoryLabel.trim()
                : "Khác";
        set.add(c);
    }
    return [...set].sort(function (a, b) {
        return a.localeCompare(b, "vi");
    });
}

function renderStaffFullMenuPanel(wrap) {
    var scrollEl = wrap.querySelector(".staff-menu-panel-scroll");
    var catSel = wrap.querySelector(".staff-menu-cat-select");
    var inp = wrap.querySelector(".staff-line-menu-search");
    if (!scrollEl || !catSel) return;

    var prevCat = String(catSel.value || "");

    catSel.replaceChildren();
    var optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Tất cả danh mục";
    catSel.appendChild(optAll);
    var allCats = getStaffWalkInSortedCategories();
    for (var k = 0; k < allCats.length; k++) {
        var opt = document.createElement("option");
        opt.value = allCats[k];
        opt.textContent = allCats[k];
        catSel.appendChild(opt);
    }
    if (prevCat && allCats.indexOf(prevCat) >= 0) {
        catSel.value = prevCat;
    } else {
        catSel.value = "";
    }

    scrollEl.replaceChildren();

    if (!staffWalkInMenuItems.length) {
        var empty = document.createElement("div");
        empty.className = "staff-menu-panel-empty px-3 py-2 small text-muted";
        empty.textContent = "Chưa có dữ liệu menu.";
        scrollEl.appendChild(empty);
        return;
    }

    var q = normalizeStaffMenuQuery(inp ? inp.value : "");
    var filtered = staffWalkInMenuItems.slice();
    if (q) {
        filtered = filtered.filter(function (m) {
            return m.nameNorm.includes(q);
        });
    }
    var catFilter = String(catSel.value || "").trim();
    if (catFilter) {
        filtered = filtered.filter(function (m) {
            var c =
                typeof m.categoryLabel === "string" && m.categoryLabel.trim().length
                    ? m.categoryLabel.trim()
                    : "Khác";
            return c === catFilter;
        });
    }

    filtered.sort(function (a, b) {
        return a.name.localeCompare(b.name, "vi");
    });

    if (!filtered.length) {
        var none = document.createElement("div");
        none.className = "staff-menu-panel-empty px-3 py-2 small text-muted";
        none.textContent = "Không có món phù hợp.";
        scrollEl.appendChild(none);
        return;
    }

    function appendItemButton(m) {
        var bt = document.createElement("button");
        bt.type = "button";
        bt.className = "staff-menu-panel-item";
        bt.setAttribute("role", "option");
        bt.dataset.id = String(m.id);
        var line = m.name;
        if (m.price != null && Number.isFinite(Number(m.price))) {
            line +=
                " · " +
                Number(m.price).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) +
                "\u202fđ";
        }
        bt.textContent = line;
        scrollEl.appendChild(bt);
    }

    if (catFilter) {
        for (var j = 0; j < filtered.length; j++) {
            appendItemButton(filtered[j]);
        }
        return;
    }

    var byCat = new Map();
    for (var i = 0; i < filtered.length; i++) {
        var mx = filtered[i];
        var c =
            typeof mx.categoryLabel === "string" && mx.categoryLabel.trim().length
                ? mx.categoryLabel.trim()
                : "Khác";
        if (!byCat.has(c)) byCat.set(c, []);
        byCat.get(c).push(mx);
    }
    var cats = [...byCat.keys()].sort(function (a, b) {
        return a.localeCompare(b, "vi");
    });

    for (var ci = 0; ci < cats.length; ci++) {
        var cat = cats[ci];
        var h = document.createElement("div");
        h.className = "staff-menu-cat-heading small fw-semibold text-secondary px-2 py-1";
        h.textContent = cat;
        scrollEl.appendChild(h);

        var bucket = /** @type {typeof staffWalkInMenuItems} */ (byCat.get(cat));
        for (var j2 = 0; j2 < bucket.length; j2++) {
            appendItemButton(bucket[j2]);
        }
    }
}

function syncStaffLineMenuCombosAfterChoicesLoad() {
    document.querySelectorAll("#staff-order-lines-body tr").forEach(function (tr) {
        const hid = tr.querySelector(".staff-line-menu-id");
        const inp = tr.querySelector(".staff-line-menu-search");
        if (!hid || !inp) return;
        const id = hid.value;
        if (!id) return;
        const m = staffWalkInMenuItems.find(function (x) {
            return String(x.id) === String(id);
        });
        if (m) inp.value = m.name;
        else {
            hid.value = "";
            inp.value = "";
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (!token) {
        window.location.href = "../dangnhap.html";
        return;
    }

    applyViewModeUi();
    bindViewModeButtons();
    bindFilterButtons();
    bindOrderTableRowOpens();
    bindHistoryPagination();
    initStaffWalkInModal();
    initStaffAddItemsModal();

    // FUNC_ORDER_14/26: Export CSV
    const exportBtn = document.querySelector('button[title="Xu\u1ea5t file (s\u1eafp t\u1edbi)"]') ||
        document.querySelector('.btn-icon-tool[title*="Xu\u1ea5t"]');
    if (exportBtn) {
        exportBtn.title = "Xu\u1ea5t CSV";
        exportBtn.addEventListener("click", exportOrdersCSV);
    }
    getOrderDetailModalInstance();
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
            if (viewMode === "ACTIVE") {
                historyCurrentPage = 1;
                loadOrders();
            } else {
                historyCurrentPage = 1;
                loadOrderHistory();
            }
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

/** Một instance Bootstrap Modal cho `#order-detail-modal` (getOrCreateInstance, khởi tạo lười/không trùng). */
function getOrderDetailModalInstance() {
    const modalEl = document.getElementById("order-detail-modal");
    if (!modalEl || typeof bootstrap === "undefined") return null;
    if (!orderDetailModalInstance) {
        orderDetailModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    }
    return orderDetailModalInstance;
}

function bindOrderTableRowOpens() {
    const tbody = document.getElementById("order-table-body");
    if (!tbody) return;
    tbody.addEventListener("click", (e) => {
        const payBtn = e.target.closest("button[data-pay-method]");
        if (payBtn) {
            const rawId = payBtn.dataset.orderId;
            const method = payBtn.dataset.payMethod;
            const id = Number(rawId);
            if (Number.isFinite(id) && (method === "CASH" || method === "QR_CODE")) {
                e.preventDefault();
                payOrder(id, method);
            }
            return;
        }
        const detailHist = e.target.closest("button.order-history-detail");
        if (detailHist && detailHist.dataset.orderId != null && detailHist.dataset.orderId !== "") {
            const id = Number(detailHist.dataset.orderId);
            if (Number.isFinite(id)) openOrderDetail(id);
            return;
        }
        const addOpen = e.target.closest("button.staff-add-items-open");
        if (addOpen && addOpen.dataset.orderId != null && addOpen.dataset.orderId !== "") {
            e.stopPropagation();
            const id = Number(addOpen.dataset.orderId);
            if (Number.isFinite(id)) openStaffAddItemsModal(id);
            return;
        }
        if (e.target.closest("a")) return;
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

function bindHistoryPagination() {
    const pagination = document.getElementById("order-history-pagination");
    if (!pagination) return;
    pagination.addEventListener("click", (e) => {
        const btn = e.target.closest("button.order-history-page-link[data-page]");
        if (!btn || btn.disabled) return;
        const nextPage = Number(btn.dataset.page);
        if (!Number.isFinite(nextPage) || nextPage < 1 || nextPage === historyCurrentPage) return;
        historyCurrentPage = nextPage;
        renderTable();
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
        historyCurrentPage = 1;
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

/** Thêm món vào đơn: đang chuẩn bị / đang phục vụ / chờ thu (COMPLETED+UNPAID); không cho đơn mới (PENDING) hoặc đã thanh toán. */
function canStaffAppendItems(order) {
    if (viewMode === "HISTORY" || !order) return false;
    if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") return false;
    if (order.status === "CANCELLED" || order.status === "PENDING") return false;
    if (order.status === "PREPARING" || order.status === "SERVING") return true;
    return order.status === "COMPLETED" && order.paymentStatus === "UNPAID";
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
    const paginationNav = document.getElementById("order-history-pagination-nav");
    const paginationEl = document.getElementById("order-history-pagination");
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
        if (paginationEl) paginationEl.innerHTML = "";
        if (paginationNav) paginationNav.classList.add("d-none");
        return;
    }

    if (viewMode === "HISTORY") {
        const totalPages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
        if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
        if (historyCurrentPage < 1) historyCurrentPage = 1;
        const start = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE;
        const end = start + HISTORY_PAGE_SIZE;
        const pageRows = rows.slice(start, end);
        tbody.innerHTML = pageRows.map(renderRow).join("");
        renderHistoryPagination(totalPages);
        if (paginationNav) paginationNav.classList.remove("d-none");
    } else {
        tbody.innerHTML = rows.map(renderRow).join("");
        if (paginationEl) paginationEl.innerHTML = "";
        if (paginationNav) paginationNav.classList.add("d-none");
    }

    if (meta) {
        if (viewMode === "HISTORY") {
            const startIndex = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE + 1;
            const endIndex = Math.min(historyCurrentPage * HISTORY_PAGE_SIZE, rows.length);
            meta.textContent = `Hiển thị ${startIndex}-${endIndex} trên ${rows.length} đơn đã hoàn thành & đã thanh toán`;
        } else {
            meta.textContent = `Đang hiển thị ${rows.length} trên ${allOrders.length} đơn đang xử lý`;
        }
    }
}

function renderHistoryPagination(totalPages) {
    const pagination = document.getElementById("order-history-pagination");
    if (!pagination) return;
    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }

    const maxButtons = 5;
    let startPage = Math.max(1, historyCurrentPage - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;
    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    const items = [];
    items.push(renderHistoryPaginationItem("Trước", historyCurrentPage - 1, historyCurrentPage === 1, false));
    for (let page = startPage; page <= endPage; page++) {
        items.push(renderHistoryPaginationItem(String(page), page, false, page === historyCurrentPage));
    }
    items.push(
        renderHistoryPaginationItem("Sau", historyCurrentPage + 1, historyCurrentPage === totalPages, false)
    );
    pagination.innerHTML = items.join("");
}

function renderHistoryPaginationItem(label, page, disabled, active) {
    const liClasses = ["page-item"];
    if (disabled) liClasses.push("disabled");
    if (active) liClasses.push("active");
    const safePage = Number.isFinite(Number(page)) ? Number(page) : 1;
    return `<li class="${liClasses.join(" ")}">
        <button class="page-link order-history-page-link" type="button" data-page="${safePage}" ${
        disabled ? "disabled" : ""
    }>${escapeHtml(label)}</button>
    </li>`;
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
            <td class="text-end pe-4 order-actions-cell" role="presentation">
                ${renderActionButtons(order)}
            </td>
        </tr>
    `;
}

/** Liên kết sang Thu ngân (US20); nhảy tới hóa đơn nhờ ?focusOrder= */
function cashierHref(orderId) {
    return `qlthanhtoan.html?focusOrder=${encodeURIComponent(String(orderId))}`;
}

function renderGoToCashier(orderId) {
    const safeId = typeof orderId === "number" && Number.isFinite(orderId) ? orderId : Number.parseInt(String(orderId), 10);
    if (!Number.isFinite(safeId)) {
        return '<span class="small text-secondary">Không có thao tác</span>';
    }
    const href = escapeHtml(cashierHref(safeId));
    return `<div class="d-inline-flex flex-wrap gap-2 justify-content-end align-items-center">
            <span class="small text-secondary d-none d-xl-inline me-1">Chờ thu · chuyển quầy</span>
            <a class="btn btn-outline-secondary btn-sm" href="${href}">Mở Thanh toán</a>
        </div>`;
}

/** Set trạng thái đang xử lý cho các nút thanh toán của 1 đơn (FUNC_ORDER_10/22/23) */
function setPayBtnsLoading(orderId, loading) {
    const n = Number(orderId);
    if (!Number.isFinite(n)) return;
    const idStr = String(Math.trunc(n));
    document
        .querySelectorAll(`button[data-pay-method][data-order-id="${idStr}"]`)
        .forEach((btn) => {
            btn.disabled = loading;
        });
}

/** FUNC_ORDER_08/09/10/21/22/23/24: Thanh toán trực tiếp */
async function payOrder(orderId, method) {
    const numericId =
        typeof orderId === "number" && Number.isFinite(orderId) ? orderId : Number.parseInt(String(orderId), 10);
    if (!Number.isFinite(numericId)) {
        showAlert("Mã đơn không hợp lệ.", "error");
        return;
    }
    const order = allOrders.find(o => Number(o?.id) === numericId);
    if (!order) {
        showAlert("Không thấy đơn trong danh sách hiện tại (có thể đã hết hạn). Vui lòng làm mới trang hoặc chọn lại đơn.", "error");
        return;
    }
    if (!needsStaffPayment(order)) {
        showAlert("Đơn này chưa đến bước thu tiền.", "error");
        return;
    }
    setPayBtnsLoading(numericId, true);
    try {
        await api(`/staff/orders/${numericId}/payment?method=${encodeURIComponent(method)}`, { method: "PATCH" });
        const methodLabel = method === "CASH" ? "Tiền mặt" : "QR / Chuyển khoản";
        showAlert(`Thanh toán thành công (${methodLabel}).`, "success");
        await reloadCurrentOrderLists();
    } catch (err) {
        showAlert(err.message || "Thanh toán thất bại.", "error");
    } finally {
        setPayBtnsLoading(numericId, false);
    }
}

function renderActionButtons(order) {
    const addBtn = canStaffAppendItems(order)
        ? `<button type="button" class="btn btn-outline-light btn-sm rounded-3 staff-add-items-open" data-order-id="${order.id}" onclick="event.stopPropagation();openStaffAddItemsModal(${order.id})" title="Thêm món vào đơn">
                <span class="material-symbols-outlined align-middle fs-6 me-1">add_shopping_cart</span>Thêm món
            </button>`
        : "";

    if (viewMode === "HISTORY") {
        return `<button type="button" class="btn btn-link btn-sm p-0 order-history-detail text-primary text-decoration-underline fw-semibold" data-order-id="${order.id}" title="Xem chi tiết đơn">Chi tiết</button>`;
    }
    if (order.status === "PENDING") {
        return `<button type="button" class="btn btn-settle" onclick="event.stopPropagation();updateOrderStatus(${order.id}, 'PREPARING')">Xác nhận & chuyển bếp</button>`;
    }
    if (order.status === "PREPARING") {
        return `<div class="d-inline-flex flex-wrap gap-1 justify-content-end">${addBtn}<button type="button" class="btn btn-table-action" onclick="event.stopPropagation();updateOrderStatus(${order.id}, 'SERVING')">Đánh dấu phục vụ</button></div>`;
    }
    if (order.status === "SERVING") {
        if (addBtn) {
            return `<div class="d-inline-flex flex-wrap gap-1 justify-content-end">${addBtn}</div>`;
        }
        return `<span class="small text-secondary">Không có thao tác</span>`;
    }
    if (needsStaffPayment(order)) {
        return `<div class="d-inline-flex flex-wrap gap-1 justify-content-end align-items-center">${addBtn}${renderGoToCashier(order.id)}</div>`;
    }
    if (addBtn) {
        return `<div class="d-inline-flex flex-wrap gap-1 justify-content-end">${addBtn}</div>`;
    }
    return `<span class="small text-secondary">Không có thao tác</span>`;
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

// FUNC_ORDER_14/26: Export CSV
function exportOrdersCSV() {
    const statusLabel = {
        PENDING: "\u0110\u01a1n m\u1edbi",
        PREPARING: "\u0110ang chu\u1ea9n b\u1ecb",
        SERVING: "\u0110ang ph\u1ee5c v\u1ee5",
        COMPLETED: "Ho\u00e0n th\u00e0nh",
        CANCELLED: "\u0110\u00e3 h\u1ee7y"
    };
    const methodLabel = { CASH: "Ti\u1ec1n m\u1eb7t", QR_CODE: "QR/CK", CARD: "Th\u1ebb", TRANSFER: "Chuy\u1ec3n kho\u1ea3n" };
    const payLabel = { UNPAID: "Ch\u01b0a thanh to\u00e1n", PAID: "\u0110\u00e3 thanh to\u00e1n", FAILED: "Th\u1ea5t b\u1ea1i" };
    const headers = ["M\u00e3 \u0111\u01a1n", "B\u00e0n", "Kh\u00e1ch", "Tr\u1ea1ng th\u00e1i \u0111\u01a1n", "T\u1ed5ng ti\u1ec1n", "Thanh to\u00e1n", "Ph\u01b0\u01a1ng th\u1ee9c", "Th\u1eddi gian"];
    const rows = getFilteredOrders().map(o => {
        const timeRaw = viewMode === "HISTORY" ? o.paidAt : o.createdAt;
        return [
            String(o.id || ""),
            o.tableNumber || (o.tableId != null ? `B\u00e0n ${o.tableId}` : ""),
            o.guestName || "Kh\u00e1ch v\u00e3ng lai",
            o.status === "COMPLETED" && o.paymentStatus === "UNPAID" ? "Ch\u1edd thanh to\u00e1n" : (statusLabel[o.status] || o.status || ""),
            Number(o.totalAmount || 0).toLocaleString("vi-VN"),
            payLabel[o.paymentStatus] || o.paymentStatus || "",
            methodLabel[o.paymentMethod] || o.paymentMethod || "",
            formatDateTime(timeRaw)
        ];
    });
    const BOM = "\uFEFF";
    const csv = BOM + [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `donhang_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function openOrderDetail(orderId) {
    const modalInst = getOrderDetailModalInstance();
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
            `<tr><td colspan="5" class="ps-3 py-3 text-secondary">${escapeHtml(
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
    setTextEl("detail-updated", "—");
    const addWrap = document.getElementById("order-detail-add-items-wrap");
    if (addWrap) addWrap.classList.add("d-none");
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

function lineIsAddedLater(line) {
    return line && line.addedToOrderAt != null && String(line.addedToOrderAt).trim() !== "";
}

function orderDetailLineKindCell(line) {
    if (!lineIsAddedLater(line)) {
        return '<span class="badge rounded-pill bg-secondary bg-opacity-25 text-secondary-emphasis border border-secondary border-opacity-25 small">Ban đầu</span>';
    }
    const when = formatDateTime(line.addedToOrderAt);
    const title = when && when !== "—" ? "Thêm lúc: " + when : "Món gọi thêm";
    return `<span class="badge rounded-pill bg-info bg-opacity-25 text-info border border-info border-opacity-35 small" title="${escapeHtml(
        title
    )}">Món thêm</span>`;
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
    const payHtml = translatePayment(d.paymentStatus, d.paymentMethod, d.paidAt);
    if (payEl) payEl.innerHTML = payHtml;

    setTextEl("detail-created", formatDateTime(d.createdAt));
    setTextEl("detail-updated", formatDateTime(d.updatedAt));

    const noteTxt = (d.note && String(d.note).trim()) || "Không có";
    setHtmlEl("detail-note", escapeHtml(noteTxt));

    const totalEl = document.getElementById("detail-total");
    if (totalEl) totalEl.textContent = formatCurrency(d.totalAmount);

    const addWrap = document.getElementById("order-detail-add-items-wrap");
    const addBtn = document.getElementById("order-detail-add-items-btn");
    if (addWrap && addBtn) {
        if (canStaffAppendItems(d)) {
            addWrap.classList.remove("d-none");
            addBtn.dataset.orderId = String(d.id);
        } else {
            addWrap.classList.add("d-none");
            delete addBtn.dataset.orderId;
        }
    }

    const linesBody = document.getElementById("order-detail-lines-body");
    const items = Array.isArray(d.items) ? d.items : [];
    if (linesBody) {
        if (!items.length) {
            linesBody.innerHTML =
                `<tr><td colspan="5" class="text-center py-4 text-secondary">Không có dòng món.</td></tr>`;
        } else {
            linesBody.innerHTML = items
                .map((line) => {
                    const name = escapeHtml(line.itemName || "Món");
                    const qty = Number(line.quantity) || 0;
                    const unit = formatCurrency(line.unitPrice);
                    const sub = formatCurrency(line.subtotal);
                    const kind = orderDetailLineKindCell(line);
                    const n = line.note && String(line.note).trim()
                        ? `<div class="line-note mt-1"><span class="material-symbols-outlined align-middle text-secondary me-1" style="font-size:0.95rem;line-height:1;vertical-align:-2px;">edit_note</span>${escapeHtml(line.note)}</div>`
                        : "";
                    return `<tr>
              <td class="ps-3">${name}${n}</td>
              <td class="text-center align-middle">${kind}</td>
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

/* ——— Thêm món vào đơn hiện có ——— */
let staffAddItemsBootstrapModal = null;
let staffAddItemsOrderId = null;
/** @type {{ menuItemId: number, name: string, price: number | null, imageUrl: string, quantity: number, note: string }[]} */
let staffAddItemsCart = [];

function getStaffAddItemsModal() {
    const el = document.getElementById("staff-add-items-modal");
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) return null;
    if (!staffAddItemsBootstrapModal) {
        staffAddItemsBootstrapModal =
            typeof bootstrap.Modal.getOrCreateInstance === "function"
                ? bootstrap.Modal.getOrCreateInstance(el)
                : new bootstrap.Modal(el);
    }
    return staffAddItemsBootstrapModal;
}

function resetStaffAddItemsCart() {
    staffAddItemsCart = [];
}

function staffAddItemsCartKey(menuItemId, note) {
    return String(menuItemId) + "\u0000" + String(note || "").trim();
}

function staffAddItemsFindCartLine(menuItemId, note) {
    const k = staffAddItemsCartKey(menuItemId, note);
    return staffAddItemsCart.findIndex((l) => staffAddItemsCartKey(l.menuItemId, l.note) === k);
}

function syncStaffAddItemsConfirmEnabled() {
    const btn = document.getElementById("staff-add-items-confirm");
    if (btn) btn.disabled = staffAddItemsCart.length === 0;
}

function populateStaffAddItemsCategorySelect() {
    const sel = document.getElementById("staff-add-items-category");
    if (!sel) return;
    const cats = getStaffWalkInSortedCategories();
    sel.innerHTML =
        `<option value="">${escapeHtml("Tất cả danh mục")}</option>` +
        cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function getStaffAddItemsFilteredMenu() {
    const q = normalizeStaffMenuQuery(document.getElementById("staff-add-items-search")?.value || "");
    const cat = String(document.getElementById("staff-add-items-category")?.value || "").trim();
    let list = staffWalkInMenuItems.slice();
    if (cat) list = list.filter((m) => (m.categoryLabel || "Khác") === cat);
    if (q) list = list.filter((m) => m.nameNorm.includes(q));
    return list;
}

function renderStaffAddItemsMenuGrid() {
    const root = document.getElementById("staff-add-items-menu-grid");
    if (!root) return;
    if (!staffWalkInMenuItems.length) {
        root.innerHTML = `<p class="text-secondary small mb-0">Chưa tải được thực đơn. Đóng modal và thử mở lại, hoặc mở &quot;Tạo đơn gắn bàn&quot; một lần để nạp menu.</p>`;
        return;
    }
    const list = getStaffAddItemsFilteredMenu();
    if (!list.length) {
        root.innerHTML = `<p class="text-secondary small mb-0">Không có món phù hợp bộ lọc.</p>`;
        return;
    }
    root.innerHTML = list
        .map((m) => {
            const price =
                m.price != null && Number.isFinite(Number(m.price))
                    ? Number(m.price).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + "\u202fđ"
                    : "—";
            const img =
                m.imageUrl && String(m.imageUrl).trim().length
                    ? `<img class="staff-add-item-card-img" src="${escapeHtml(m.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling && (this.nextElementSibling.style.display='flex');" />`
                    : "";
            const ph = `<div class="staff-add-item-card-img staff-add-item-card-img-ph"${m.imageUrl ? ` style="display:none"` : ""}><span class="material-symbols-outlined">restaurant</span></div>`;
            return `<div class="staff-add-item-card">
                <div class="staff-add-item-card-media">${img}${ph}</div>
                <div class="staff-add-item-card-body">
                    <p class="staff-add-item-card-name mb-1">${escapeHtml(m.name)}</p>
                    <p class="staff-add-item-card-price mb-2">${escapeHtml(price)}</p>
                    <button type="button" class="btn btn-sm btn-primary rounded-3 w-100 staff-add-item-pick" data-menu-id="${m.id}">Thêm</button>
                </div>
            </div>`;
        })
        .join("");
}

function renderStaffAddItemsCart() {
    const empty = document.getElementById("staff-add-items-cart-empty");
    const wrap = document.getElementById("staff-add-items-cart-wrap");
    const body = document.getElementById("staff-add-items-cart-body");
    if (!empty || !wrap || !body) return;
    if (!staffAddItemsCart.length) {
        empty.classList.remove("d-none");
        wrap.classList.add("d-none");
        body.innerHTML = "";
        syncStaffAddItemsConfirmEnabled();
        return;
    }
    empty.classList.add("d-none");
    wrap.classList.remove("d-none");
    body.innerHTML = staffAddItemsCart
        .map((line, idx) => {
            const price =
                line.price != null && Number.isFinite(Number(line.price))
                    ? Number(line.price).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + "\u202fđ"
                    : "—";
            return `<tr data-cart-idx="${idx}">
                <td class="ps-3 align-middle">
                    <div class="fw-semibold">${escapeHtml(line.name)}</div>
                    <div class="small text-secondary">${escapeHtml(price)}/suất</div>
                </td>
                <td class="align-middle text-center">
                    <div class="d-inline-flex align-items-center gap-1">
                        <button type="button" class="btn btn-outline-secondary btn-sm px-2 staff-add-cart-dec" data-idx="${idx}" title="Giảm">−</button>
                        <input type="number" min="1" max="999" class="form-control form-control-sm text-center staff-add-cart-qty" style="width:3.5rem" data-idx="${idx}" value="${line.quantity}" />
                        <button type="button" class="btn btn-outline-secondary btn-sm px-2 staff-add-cart-inc" data-idx="${idx}" title="Tăng">+</button>
                    </div>
                </td>
                <td class="align-middle">
                    <input type="text" class="form-control form-control-sm rounded-3 staff-add-cart-note" data-idx="${idx}" maxlength="500" placeholder="Ghi chú (tuỳ chọn)" value="${escapeHtml(line.note)}" />
                </td>
                <td class="text-end align-middle pe-2">
                    <button type="button" class="btn btn-link btn-sm text-danger p-0 staff-add-cart-remove" data-idx="${idx}" title="Xóa">✕</button>
                </td>
            </tr>`;
        })
        .join("");
    syncStaffAddItemsConfirmEnabled();
}

function staffAddItemsPickByMenuId(menuItemId) {
    const m = staffWalkInMenuItems.find((x) => String(x.id) === String(menuItemId));
    if (!m) return;
    const ix = staffAddItemsFindCartLine(m.id, "");
    if (ix >= 0) {
        staffAddItemsCart[ix].quantity += 1;
    } else {
        staffAddItemsCart.push({
            menuItemId: m.id,
            name: m.name,
            price: m.price,
            imageUrl: m.imageUrl || "",
            quantity: 1,
            note: ""
        });
    }
    renderStaffAddItemsCart();
}

function populateStaffAddItemsCurrentLines(d) {
    const tbody = document.getElementById("staff-add-items-current-lines");
    if (!tbody) return;
    const items = Array.isArray(d.items) ? d.items : [];
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-secondary">Chưa có món.</td></tr>`;
        return;
    }
    tbody.innerHTML = items
        .map((line) => {
            const name = escapeHtml(line.itemName || "Món");
            const qty = Number(line.quantity) || 0;
            const sub = formatCurrency(line.subtotal);
            const kind = orderDetailLineKindCell(line);
            return `<tr><td class="ps-3">${name}</td><td class="text-center">${kind}</td><td class="text-center">${qty}</td><td class="text-end pe-3">${sub}</td></tr>`;
        })
        .join("");
}

async function openStaffAddItemsModal(orderId) {
    const id = Number(orderId);
    if (!Number.isFinite(id)) return;
    const modal = getStaffAddItemsModal();
    if (!modal) return;

    staffAddItemsOrderId = id;
    resetStaffAddItemsCart();
    renderStaffAddItemsCart();

    const paidAlert = document.getElementById("staff-add-items-paid-alert");
    const main = document.getElementById("staff-add-items-main");
    if (paidAlert) {
        paidAlert.classList.add("d-none");
        paidAlert.textContent = "";
    }
    if (main) main.classList.remove("d-none");

    if (document.getElementById("staff-add-items-search")) document.getElementById("staff-add-items-search").value = "";
    populateStaffAddItemsCategorySelect();

    try {
        if (!staffWalkInMenuItems.length) {
            await ensureStaffWalkInChoices();
        }
        const d = await fetchOrderDetail(id);
        if (d.paymentStatus === "PAID" || d.paymentStatus === "REFUNDED") {
            if (main) main.classList.add("d-none");
            if (paidAlert) {
                paidAlert.textContent = "Đơn hàng đã thanh toán — không thể thêm món.";
                paidAlert.classList.remove("d-none");
            }
            syncStaffAddItemsConfirmEnabled();
            modal.show();
            return;
        }
        if (!canStaffAppendItems(d)) {
            showAlert("Không thể thêm món vào đơn ở trạng thái hiện tại.", "error");
            return;
        }
        const titleEl = document.getElementById("staff-add-items-title");
        const subEl = document.getElementById("staff-add-items-sub");
        if (titleEl) titleEl.textContent = `Thêm món · Đơn #${d.id}`;
        const tbl = d.tableNumber || (d.tableId != null ? `Bàn ${d.tableId}` : "—");
        if (subEl) subEl.textContent = `${tbl} · ${orderStatusLabel(d)}`;
        setTextEl("staff-add-items-table", tbl);
        setTextEl("staff-add-items-order-id", `#${d.id}`);
        const tot = document.getElementById("staff-add-items-current-total");
        if (tot) tot.textContent = formatCurrency(d.totalAmount);
        populateStaffAddItemsCurrentLines(d);
        renderStaffAddItemsMenuGrid();
        modal.show();
    } catch (e) {
        showAlert(e.message || "Không tải được đơn.", "error");
    }
}

async function submitStaffAddItems() {
    if (!staffAddItemsOrderId || !staffAddItemsCart.length) return;
    const btn = document.getElementById("staff-add-items-confirm");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Đang gửi…";
    }
    try {
        const items = staffAddItemsCart.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: Math.max(1, Math.min(999, Number(l.quantity) || 1)),
            note: (l.note && String(l.note).trim()) || null
        }));
        await apiPost(`/staff/orders/${staffAddItemsOrderId}/items`, { items });
        showAlert("Đã thêm món vào đơn.", "success");
        getStaffAddItemsModal()?.hide();
        await reloadCurrentOrderLists();
    } catch (e) {
        showAlert(e.message || "Không thêm được món.", "error");
    } finally {
        if (btn) {
            btn.textContent = "Xác nhận thêm món";
            syncStaffAddItemsConfirmEnabled();
        }
    }
}

function initStaffAddItemsModal() {
    if (document.body.dataset.staffAddItemsInit === "1") return;
    document.body.dataset.staffAddItemsInit = "1";
    const grid = document.getElementById("staff-add-items-menu-grid");
    if (!grid) return;
    grid.addEventListener("click", (e) => {
        const b = e.target.closest("button.staff-add-item-pick");
        if (!b || b.dataset.menuId == null) return;
        staffAddItemsPickByMenuId(Number(b.dataset.menuId));
    });

    const search = document.getElementById("staff-add-items-search");
    if (search) {
        search.addEventListener("input", () => renderStaffAddItemsMenuGrid());
    }
    const cat = document.getElementById("staff-add-items-category");
    if (cat) {
        cat.addEventListener("change", () => renderStaffAddItemsMenuGrid());
    }

    const cartWrap = document.getElementById("staff-add-items-cart-wrap");
    if (cartWrap) {
        cartWrap.addEventListener("click", (e) => {
            const rm = e.target.closest("button.staff-add-cart-remove");
            if (rm && rm.dataset.idx != null) {
                const i = Number(rm.dataset.idx);
                if (Number.isFinite(i)) staffAddItemsCart.splice(i, 1);
                renderStaffAddItemsCart();
                return;
            }
            const dec = e.target.closest("button.staff-add-cart-dec");
            const inc = e.target.closest("button.staff-add-cart-inc");
            const btn = dec || inc;
            if (!btn || btn.dataset.idx == null) return;
            const i = Number(btn.dataset.idx);
            if (!Number.isFinite(i) || !staffAddItemsCart[i]) return;
            if (dec) staffAddItemsCart[i].quantity = Math.max(1, (Number(staffAddItemsCart[i].quantity) || 1) - 1);
            else staffAddItemsCart[i].quantity = Math.min(999, (Number(staffAddItemsCart[i].quantity) || 1) + 1);
            renderStaffAddItemsCart();
        });
        cartWrap.addEventListener("change", (e) => {
            const inp = e.target.closest("input.staff-add-cart-qty");
            if (!inp || inp.dataset.idx == null) return;
            const i = Number(inp.dataset.idx);
            if (!Number.isFinite(i) || !staffAddItemsCart[i]) return;
            let v = Number.parseInt(String(inp.value), 10);
            if (!Number.isFinite(v) || v < 1) v = 1;
            if (v > 999) v = 999;
            staffAddItemsCart[i].quantity = v;
            renderStaffAddItemsCart();
        });
        cartWrap.addEventListener("input", (e) => {
            const n = e.target.closest("input.staff-add-cart-note");
            if (!n || n.dataset.idx == null) return;
            const i = Number(n.dataset.idx);
            if (!Number.isFinite(i) || !staffAddItemsCart[i]) return;
            staffAddItemsCart[i].note = String(n.value || "");
        });
    }

    document.getElementById("staff-add-items-confirm")?.addEventListener("click", submitStaffAddItems);

    document.getElementById("order-detail-add-items-btn")?.addEventListener("click", (e) => {
        const raw = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.orderId : "";
        const id = Number(raw);
        if (Number.isFinite(id)) openStaffAddItemsModal(id);
    });
}

window.openStaffAddItemsModal = openStaffAddItemsModal;

/* ——— Nhân viên tạo đơn gắn bàn ——— */
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
            syncStaffLineMenuCombosAfterChoicesLoad();
        } catch (_e) {
            showAlert("Không tải được danh sách bàn hoặc menu. Kiểm tra kết nối và đăng nhập nhân viên.", "error");
        }
    });

    modalEl.addEventListener("shown.bs.modal", () => {
        const g = document.getElementById("staff-order-guest");
        if (g) g.focus();
    });

    modalEl.addEventListener("click", (e) => {
        if (!e.target.closest(".staff-menu-combo-wrap")) {
            hideAllStaffMenuSuggests();
            hideAllStaffMenuPanels();
        }
    });

    if (addBtn) addBtn.addEventListener("click", () => addStaffOrderLine());

    if (tbody) {
        tbody.addEventListener("change", (e) => {
            const sel = e.target.closest(".staff-menu-cat-select");
            if (!sel || !tbody.contains(sel)) return;
            const wrap = staffWalkInClosestComboWrap(sel);
            if (!wrap) return;
            cancelStaffPanelFrame(wrap);
            renderStaffFullMenuPanel(wrap);
        });

        tbody.addEventListener("click", (e) => {
            const tgl = e.target.closest(".staff-menu-panel-toggle");
            if (tgl && tbody.contains(tgl)) {
                e.preventDefault();
                e.stopPropagation();
                const wrap = staffWalkInClosestComboWrap(tgl);
                if (!wrap) return;
                const panel = wrap.querySelector(".staff-menu-panel");
                const wasOpen = panel && !panel.classList.contains("d-none");

                hideAllStaffMenuPanels();
                hideAllStaffMenuSuggests();

                if (!wasOpen && panel) {
                    const ul = wrap.querySelector(".staff-menu-suggest");
                    if (ul) {
                        cancelStaffSuggestFrame(ul);
                        ul.classList.add("d-none");
                        ul.innerHTML = "";
                    }
                    panel.classList.remove("d-none");
                    tgl.setAttribute("aria-expanded", "true");
                    cancelStaffPanelFrame(wrap);
                    renderStaffFullMenuPanel(wrap);
                }
                return;
            }

            const rm = e.target.closest(".staff-line-remove");
            if (!rm) return;
            const tr = rm.closest("tr");
            const n = tbody.querySelectorAll("tr").length;
            if (tr && n > 1) tr.remove();
        });

        tbody.addEventListener("mousedown", (e) => {
            const sug = e.target.closest(".staff-menu-suggest-item");
            const pit = e.target.closest(".staff-menu-panel-item");
            const item = sug || pit;
            if (!item || !tbody.contains(item)) return;
            e.preventDefault();
            const id = item.getAttribute("data-id");
            if (!id) return;
            const wrap = staffWalkInClosestComboWrap(item);
            if (!wrap) return;
            applyStaffWalkInMenuPick(wrap, id);
        });

        tbody.addEventListener("focusin", (e) => {
            const inp = e.target.closest(".staff-line-menu-search");
            if (!inp || !tbody.contains(inp)) return;
            hideAllStaffMenuPanels();
            const wrap = inp.closest(".staff-menu-combo-wrap");
            const ul = wrap && wrap.querySelector(".staff-menu-suggest");
            if (!ul || !wrap) return;
            cancelStaffSuggestFrame(ul);
            cancelStaffPanelFrame(wrap);
            renderStaffMenuSuggestions(ul, inp.value);
        });

        tbody.addEventListener("input", (e) => {
            const inp = e.target.closest(".staff-line-menu-search");
            if (!inp || !tbody.contains(inp)) return;
            const wrap = inp.closest(".staff-menu-combo-wrap");
            if (!wrap) return;
            const hid = wrap.querySelector(".staff-line-menu-id");
            if (hid) hid.value = "";
            const ul = wrap.querySelector(".staff-menu-suggest");
            const panel = wrap.querySelector(".staff-menu-panel");
            const panelOpen = panel && !panel.classList.contains("d-none");
            if (panelOpen) {
                if (ul) cancelStaffSuggestFrame(ul);
                scheduleStaffPanelRender(wrap);
            } else if (ul) {
                cancelStaffPanelFrame(wrap);
                scheduleStaffSuggestRender(ul, inp.value);
            }
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
                const stRaw = t.status != null ? t.status : "";
                const stVi = formatTableStatusVi(stRaw);
                const st = stVi ? escapeHtml(stVi) : "";
                return `<option value="${Number(t.id)}">${num}${st ? " · " + st : ""}</option>`;
            })
            .join("");

    const resMenu = await fetch(`${BASE_URL}/menu`);
    const jsonMenu = await resMenu.json().catch(() => ({}));
    const menu = Array.isArray(jsonMenu.data) ? jsonMenu.data : [];
    staffWalkInMenuItems = menu
        .map(function (m) {
            var idNum = Number(m.id);
            var name = String(m.name != null ? m.name : "").trim();
            var catRaw = String(m.categoryName != null ? m.categoryName : "").trim();
            var img = m.imageUrl != null && String(m.imageUrl).trim().length ? String(m.imageUrl).trim() : "";
            return {
                id: idNum,
                name: name,
                price: m.price != null && !Number.isNaN(Number(m.price)) ? Number(m.price) : null,
                categoryLabel: catRaw.length ? catRaw : "Khác",
                nameNorm: normalizeStaffMenuQuery(name),
                imageUrl: img
            };
        })
        .filter(function (x) {
            return Number.isFinite(x.id) && x.id > 0 && x.name.length > 0;
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
    tbody.insertAdjacentHTML("beforeend", buildStaffOrderLineRow());
}

function buildStaffOrderLineRow() {
    return (
        `<tr>` +
        `<td class="ps-2 pt-2 align-top">` +
        `<div class="position-relative staff-menu-combo-wrap">` +
        `<input type="hidden" class="staff-line-menu-id" value="">` +
        `<div class="d-flex gap-1 align-items-center staff-menu-controls">` +
        `<input type="text" class="form-control form-control-sm flex-grow-1 rounded-3 staff-line-menu-search" maxlength="200" placeholder="Tìm món hoặc bấm menu…" autocomplete="off">` +
        `<button type="button" class="btn btn-outline-secondary btn-sm rounded-3 flex-shrink-0 staff-menu-panel-toggle px-2" aria-expanded="false" aria-label="Mở danh mục món" title="Danh mục món">` +
        `<span class="material-symbols-outlined lh-1" style="font-size:1.2rem">restaurant_menu</span>` +
        `</button></div>` +
        `<ul class="list-group position-absolute staff-menu-suggest w-100 d-none shadow-sm rounded-2 border text-start" role="listbox"></ul>` +
        `<div class="staff-menu-panel position-absolute bg-white rounded-3 border shadow-sm text-start d-none w-100" role="listbox">` +
        `<div class="staff-menu-panel-toolbar px-2 py-2 border-bottom">` +
        `<label class="form-label small text-secondary mb-1">Danh mục</label>` +
        `<select class="form-select form-select-sm staff-menu-cat-select rounded-2" aria-label="Chọn danh mục"></select>` +
        `</div>` +
        `<div class="staff-menu-panel-scroll"></div></div>` +
        `</div></td>` +
        `<td class="pt-2"><input type="number" min="1" step="1" value="1" class="form-control form-control-sm rounded-3 staff-line-qty" required /></td>` +
        `<td class="pt-2"><input type="text" class="form-control form-control-sm rounded-3 staff-line-note" maxlength="200" placeholder="Tuỳ chọn món" /></td>` +
        `<td class="text-end align-middle pe-2"><button type="button" class="btn btn-link text-danger btn-sm py-0 staff-line-remove" title="Xóa">&times;</button></td>` +
        `</tr>`
    );
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
        const hid = tr.querySelector(".staff-line-menu-id");
        const searchInp = tr.querySelector(".staff-line-menu-search");
        const qtyEl = tr.querySelector(".staff-line-qty");
        const lnEl = tr.querySelector(".staff-line-note");
        const midRaw = hid ? String(hid.value || "").trim() : "";
        const typed = searchInp ? String(searchInp.value || "").trim() : "";
        const qty = qtyEl ? Number(qtyEl.value) : NaN;
        const ln = lnEl ? String(lnEl.value || "").trim() : "";
        if (!midRaw) {
            if (typed) {
                showAlert(
                    "Chưa ghép được món: gõ ô tìm và chọn trong gợi ý, hoặc bấm biểu tượng thực đơn rồi chọn một món trong danh mục.",
                    "error"
                );
                return;
            }
            continue;
        }
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
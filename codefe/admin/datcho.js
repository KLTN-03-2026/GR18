// ================= CONFIG =================
const API_BASE_URL = (typeof window !== "undefined" && window.RESTAURANT_API_BASE) || "http://localhost:8080/api";

// ================= AXIOS =================
const axiosInstance = axios.create({
    baseURL: API_BASE_URL.replace(/\/+$/, "")
});

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ================= STATE =================
let reservations = [];
/** Danh sau lọc tìm kiếm */
let filteredRows = [];
/** Trang trong danh sách (phân trang client) */
let currentPage = 1;
const PAGE_SIZE = 6;
let staffTables = [];
let selectedDate = formatInputDate(new Date());

function extractPreferredArea(note) {
    if (!note) return "";
    const m = String(note).match(/Khu vực mong muốn:\s*([^.]*)/);
    return m ? m[1].trim() : "";
}

function extractPreferredTableNum(note) {
    if (!note) return "";
    const m = String(note).match(/Bàn mong muốn:\s*([^.]*)/);
    return m ? m[1].trim() : "";
}

function formatLocationDesk(r) {
    const loc = r.tableLocation && String(r.tableLocation).trim();
    const tn = r.tableNumber && String(r.tableNumber).trim();
    if (tn) {
        return `<div><span class="fw-semibold">${escapeHtml(tn)}</span></div><div class="cust-sub">${escapeHtml(loc || "—")}</div>`;
    }
    const area = extractPreferredArea(r.note);
    const wishBn = extractPreferredTableNum(r.note);
    const parts = [];
    if (area) parts.push(`<span class="small">Khu: ${escapeHtml(area)}</span>`);
    if (wishBn) parts.push(`<span class="small">Bàn mong muốn: ${escapeHtml(wishBn)}</span>`);
    if (!parts.length) return `<span class="cust-sub">—</span>`;
    return `<div class="d-flex flex-column gap-1">${parts.join("")}</div>`;
}

function refillEditTableSelect() {
    const sel = document.getElementById("editTableId");
    if (!sel) return;
    const keep = sel.value;
    sel.innerHTML =
        '<option value="">— Chưa gán bàn —</option>' +
        staffTables
            .map(
                (t) =>
                    `<option value="${t.id}">${escapeHtml(String(t.tableNumber))} · ${escapeHtml(
                        String(t.location || "—")
                    )} (${t.capacity} chỗ)</option>`
            )
            .join("");
    if (keep && staffTables.some((x) => String(x.id) === keep)) sel.value = keep;
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
    initDateFilter();
    bindViewTabs();
    bindPagination();
    await loadStaffTables();
    loadReservations();
    setupSearch();
});

// ================= LOAD =================
async function loadStaffTables() {
    try {
        const res = await axiosInstance.get("/tables/staff/tables");
        staffTables = res.data?.data || [];
    } catch (err) {
        console.error("loadStaffTables:", err);
        staffTables = [];
    } finally {
        refillEditTableSelect();
    }
}

async function loadReservations() {
    try {
        const res = await axiosInstance.get("/staff/reservations", {
            params: { date: selectedDate }
        });

        reservations = Array.isArray(res.data?.data) ? res.data.data : [];
        filteredRows = reservations.slice();
        currentPage = 1;
        redrawList();
        updateStats(reservations);

    } catch (err) {
        console.error("ERROR:", err);
        handleError(err);
        reservations = [];
        filteredRows = [];
        redrawList();
        updateStats([]);
        updateFooterInfo();
    }
}

// ================= RENDER =================
function redrawList() {
    renderTablePage();
    renderPaginationDash();
    updateFooterInfo();
}

function renderTablePage() {
    const tbody = document.getElementById("reservationTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const total = filteredRows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > pages) currentPage = pages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = filteredRows.slice(start, start + PAGE_SIZE);

    if (!slice.length) {
        tbody.innerHTML =
            '<tr><td colspan="6" class="text-center py-5 text-secondary">Không có đặt chỗ cho ngày này.</td></tr>';
        return;
    }

    slice.forEach((r) => {
        tbody.innerHTML += `
        <tr class="row-low">
            <td>
                <div class="cust-info">
                    <div class="avatar primary-text">${escapeHtml(getInitial(r.customerName))}</div>
                    <div>
                        <p class="cust-name">${escapeHtml(r.customerName)}</p>
                        <p class="cust-sub">${escapeHtml(String(r.customerPhone || ""))}</p>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(String(r.numberOfGuests ?? ""))}</td>
            <td>
                <p class="time-text">${formatHour(r.reservationTime)}</p>
                <p class="date-sub">${formatDate(r.reservationTime)}</p>
            </td>
            <td>${formatLocationDesk(r)}</td>
            <td>${renderStatus(r.status)}</td>
            <td class="text-end">${renderActions(r)}</td>
        </tr>`;
    });
}

function renderPaginationDash() {
    const el = document.getElementById("paginationDash");
    if (!el) return;

    const total = filteredRows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    let html = "";
    for (let p = 1; p <= pages; p++) {
        html += `<button type="button" class="${p === currentPage ? "active-pg" : ""}" data-page="${p}" aria-current="${p === currentPage ? "page" : "false"}">${p}</button>`;
    }

    el.innerHTML = html || `<button type="button" class="active-pg" data-page="1">1</button>`;
}

// ================= STATUS =================
function renderStatus(status) {
    const st = normalizeReservationStatus(status);
    switch (st) {
        case "PENDING":
            return `<span class="badge-status tertiary">Chờ xử lý</span>`;
        case "CONFIRMED":
            return `<span class="badge-status confirmed">Đã xác nhận</span>`;
        case "ARRIVED":
            return `<span class="badge-status tertiary">Đã đến</span>`;
        case "COMPLETED":
            return `<span class="badge-status completed">Hoàn thành</span>`;
        case "CANCELLED":
            return `<span class="badge-status" style="background:rgba(239,68,68,.15);color:#f87171;">Đã hủy</span>`;
        default:
            return escapeHtml(status);
    }
}

function renderActions(r) {
    const st = normalizeReservationStatus(r.status);
    return `
    <div class="action-wrap d-inline-flex align-items-center gap-2 justify-content-end flex-wrap">
        <button type="button" onclick="openEdit(${r.id})" class="btn-action-single" title="Sửa"><span class="material-symbols-outlined">edit</span></button>
        ${st === "PENDING"
            ? `<button type="button" onclick="confirmBooking(${r.id})" class="btn-action ok" title="Xác nhận">✔</button>`
            : ""}
        ${st === "CONFIRMED"
            ? `<button type="button" onclick="confirmArrival(${r.id})" class="btn-action ok" title="Khách đã đến">✔✔</button>`
            : ""}
        ${st === "ARRIVED"
            ? `<button type="button" onclick="completeBooking(${r.id})" class="btn-action ok" title="Hoàn thành">✔✔✔</button>`
            : ""}
    </div>`;
}

// ================= API =================
async function confirmBooking(id) {
    await callAPI(`/staff/reservations/${id}/confirm`);
}

async function confirmArrival(id) {
    const r = reservations.find(x => x.id === id);
    let tableId = r?.tableId != null ? r.tableId : null;
    if (tableId == null) {
        const hint = r?.tableNumber ? ` (gợi ý: ${r.tableNumber})` : "";
        const num = prompt(`Nhập số bàn thực tế khách ngồi${hint}:`, r?.tableNumber || "");
        if (num === null) {
            return;
        }
        const trimmed = String(num).trim();
        if (!trimmed) {
            alert("Cần số bàn để gắn với đơn đặt và mã QR.");
            return;
        }
        const t = staffTables.find(x => String(x.tableNumber).trim() === trimmed);
        if (!t?.id) {
            alert("Không tìm thấy bàn trùng số. Kiểm tra danh sách bàn hoặc tải lại trang.");
            return;
        }
        tableId = t.id;
    }
    try {
        await axiosInstance.patch(`/staff/reservations/${id}/arrived`, { tableId });
        loadReservations();
    } catch (err) {
        handleError(err);
    }
}

async function completeBooking(id) {
    await callAPI(`/staff/reservations/${id}/complete`);
}

async function cancelBooking(id) {
    const reason = prompt("Lý do hủy?");
    try {
        await axiosInstance.delete(`/reservations/${id}/cancel`, {
            params: { reason }
        });
        loadReservations();
    } catch (err) {
        handleError(err);
    }
}

async function callAPI(url) {
    try {
        await axiosInstance.patch(url);
        loadReservations();
    } catch (err) {
        handleError(err);
    }
}

function bindPagination() {
    document.getElementById("paginationDash")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-page]");
        if (!btn) return;
        const p = Number(btn.getAttribute("data-page"));
        if (!Number.isFinite(p) || p === currentPage) return;
        currentPage = p;
        renderTablePage();
        renderPaginationDash();
        updateFooterInfo();
    });
}

function bindViewTabs() {
    const listBtn = document.getElementById("btnViewList");
    const calBtn = document.getElementById("btnViewCalendar");
    listBtn?.addEventListener("click", () => {
        listBtn.classList.add("active");
        calBtn?.classList.remove("active");
    });
    calBtn?.addEventListener("click", () => {
        if (typeof toastr !== "undefined") {
            toastr.info("Chế độ lịch đang được phát triển.", "Thông báo");
        }
    });
}

// ================= SEARCH =================
function setupSearch() {
    const input = document.querySelector(".search-input");
    if (!input) return;

    input.addEventListener("input", (e) => {
        const val = String(e.target.value || "").toLowerCase();

        filteredRows = reservations.filter(
            (r) =>
                (r.customerName || "").toLowerCase().includes(val) ||
                String(r.customerPhone || "").includes(val)
        );
        currentPage = 1;
        redrawList();
        updateStats(reservations);
    });
}

function initDateFilter() {
    const input = document.getElementById("filterDate");
    const btnToday = document.getElementById("btnToday");
    if (!input) return;

    input.value = selectedDate;

    input.addEventListener("change", () => {
        selectedDate = input.value || formatInputDate(new Date());
        loadReservations();
    });

    btnToday?.addEventListener("click", () => {
        selectedDate = formatInputDate(new Date());
        input.value = selectedDate;
        loadReservations();
    });
}

function updateFooterInfo() {
    const el = document.getElementById("footerInfo");
    if (!el) return;
    const d = new Date(`${selectedDate}T12:00:00`);
    const total = filteredRows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > pages) currentPage = pages;
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    const range = total ? ` (${start}–${end} / ${total})` : "";
    el.textContent = `Đang hiển thị dữ liệu ngày ${d.toLocaleDateString("vi-VN")}${range}`;
}

// ================= HELPER =================
function formatHour(t) {
    const d = parseReservationDate(t);
    if (!d) return "--:--";
    return d.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDate(t) {
    const d = parseReservationDate(t);
    if (!d) return "--/--/----";
    return d.toLocaleDateString("vi-VN");
}

function formatInputDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseReservationDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value;
    if (Array.isArray(value)) {
        // LocalDateTime từ backend có thể serialize thành [yyyy,MM,dd,HH,mm,ss,nano]
        const y = Number(value[0]);
        const mo = Number(value[1] || 1) - 1;
        const d = Number(value[2] || 1);
        const h = Number(value[3] || 0);
        const mi = Number(value[4] || 0);
        const s = Number(value[5] || 0);
        const ms = Number(value[6] || 0) / 1000000;
        const asDate = new Date(y, mo, d, h, mi, s, ms);
        return isNaN(asDate) ? null : asDate;
    }
    if (typeof value === "object") {
        // Hỗ trợ object {year,monthValue,dayOfMonth,hour,minute,second,nano}
        const y = Number(value.year);
        const mo = Number(value.monthValue || value.month || 1) - 1;
        const d = Number(value.dayOfMonth || value.day || 1);
        const h = Number(value.hour || 0);
        const mi = Number(value.minute || 0);
        const s = Number(value.second || 0);
        const ms = Number(value.nano || 0) / 1000000;
        const asDate = new Date(y, mo, d, h, mi, s, ms);
        return isNaN(asDate) ? null : asDate;
    }
    if (typeof value === "number") {
        const asDate = new Date(value);
        return isNaN(asDate) ? null : asDate;
    }
    if (typeof value !== "string") return null;

    const normalized = value.trim().replace(" ", "T");
    const asDate = new Date(normalized);
    return isNaN(asDate) ? null : asDate;
}

function toDatetimeLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mm}`;
}

function getInitial(name) {
    if (!name) return "?";
    const p = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const parts = p.slice(0, 3);
    return parts.map((w) => [...w][0]).join("").toUpperCase() || "?";
}

function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ================= ERROR =================
function handleError(err) {
    console.error(err);

    if (err.response?.status === 401) {
        alert("Chưa đăng nhập");
        return;
    }

    if (err.response?.status === 403) {
        alert("Không có quyền STAFF/ADMIN");
        return;
    }

    alert(err.response?.data?.message || "Lỗi server");
}
function openEdit(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById("editId").value = r.id;
    document.getElementById("editName").value = r.customerName;
    document.getElementById("editPhone").value = r.customerPhone;
    document.getElementById("editGuests").value = r.numberOfGuests;

    const dateForEdit = parseReservationDate(r.reservationTime);
    document.getElementById("editTime").value = dateForEdit ? toDatetimeLocal(dateForEdit) : "";

    refillEditTableSelect();
    const tid = r.tableId != null ? String(r.tableId) : "";
    const sel = document.getElementById("editTableId");
    if (sel) sel.value = tid;

    new bootstrap.Modal(document.getElementById("editModal")).show();
}
async function updateReservation() {
    const id = document.getElementById("editId").value;

    if (!id) {
        alert("Mở chỉnh sửa từ biểu tượng bút chì trên một dòng đặt chỗ.");
        return;
    }

    const rawTable = document.getElementById("editTableId")?.value;
    const tableId = rawTable ? Number(rawTable) : null;

    const data = {
        customerName: document.getElementById("editName").value,
        customerPhone: document.getElementById("editPhone").value,
        numberOfGuests: parseInt(document.getElementById("editGuests").value, 10),
        reservationTime: document.getElementById("editTime").value,
        tableId: rawTable !== "" && Number.isFinite(tableId) ? tableId : null
    };

    try {
        await axiosInstance.put(`/reservations/${id}`, data);

        alert("Cập nhật thành công");

        loadReservations();

        bootstrap.Modal.getInstance(
            document.getElementById("editModal")
        )?.hide();

    } catch (err) {
        handleError(err);
    }

}
function normalizeReservationStatus(raw) {
    return String(raw == null ? "" : raw).trim().toUpperCase();
}

function formatStatCountPlain(num) {
    return String(Math.max(0, Math.floor(Number(num) || 0)));
}

function formatCounterPadded(num) {
    const n = Math.max(0, Math.floor(Number(num) || 0));
    if (n >= 100) return String(n);
    return String(n).padStart(2, "0");
}

function countRiskNoShow(rows, dayStr) {
    const now = Date.now();
    const rowsSafe = Array.isArray(rows) ? rows : [];
    return rowsSafe.filter((r) => {
        const st = normalizeReservationStatus(r.status);
        if (st !== "CONFIRMED") return false;
        const t = parseReservationDate(r.reservationTime);
        if (!t) return false;
        if (formatInputDate(t) !== dayStr) return false;
        return t.getTime() < now;
    }).length;
}

function calcGrowth(todayGuests) {
    if (todayGuests === 0) return 0;
    const yesterday = todayGuests * 0.85;
    return Math.round(((todayGuests - yesterday) / yesterday) * 100);
}

function updateStats(data) {
    const rows = Array.isArray(data) ? data : [];

    let totalGuests = 0;
    let confirmed = 0;
    let pending = 0;

    rows.forEach((r) => {
        const st = normalizeReservationStatus(r.status);
        if (st !== "CANCELLED") {
            totalGuests += r.numberOfGuests || 0;
        }
        if (st === "CONFIRMED") confirmed++;
        if (st === "PENDING") pending++;
    });

    const risk = countRiskNoShow(rows, selectedDate);

    const totalEl = document.getElementById("totalGuests");
    const confirmedEl = document.getElementById("confirmedCount");
    const pendingEl = document.getElementById("pendingCount");
    const riskEl = document.getElementById("riskCount");
    if (totalEl) totalEl.textContent = formatStatCountPlain(totalGuests);
    if (confirmedEl) confirmedEl.textContent = formatCounterPadded(confirmed);
    if (pendingEl) pendingEl.textContent = formatCounterPadded(pending);
    if (riskEl) riskEl.textContent = formatCounterPadded(risk);

    const trendEl = document.getElementById("guestTrendText");
    if (trendEl) {
        const percent = calcGrowth(totalGuests);
        trendEl.textContent = `${percent >= 0 ? "+" : ""}${percent}% so với hôm qua`;
    }
}
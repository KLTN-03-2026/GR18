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
let statusFilter = "";

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


document.addEventListener("DOMContentLoaded", async () => {
    initDateFilter();
    bindPagination();
    await loadStaffTables();
    loadReservations();
    setupSearch();
    setupStatusFilter();
    document.getElementById("btnExport")?.addEventListener("click", exportCSV);
});


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

        // FUNC_BOOKING_19 — Sắp xếp theo thời gian tăng dần
        reservations.sort((a, b) => {
            const da = parseReservationDate(a.reservationTime);
            const db = parseReservationDate(b.reservationTime);
            return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
        });

        applyFilters();

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
        const msg = statusFilter
            ? "Không có đặt chỗ phù hợp với bộ lọc."
            : "Không có đặt chỗ cho ngày này.";
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-secondary">${msg}</td></tr>`;
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


/** Đồng bộ trạng thái bàn. Trả về true khi không cần PATCH (chưa gán bàn / id không hợp lệ). Trả về false chỉ khi đã gọi PATCH mà lỗi mạng hoặc HTTP không ok. */
async function syncTableStatus(tableId, status) {
    if (status == null || String(status).trim() === "") return true;
    const idStr = tableId == null ? "" : String(tableId).trim();
    if (!idStr || idStr === "undefined" || idStr === "null" || !/^\d+$/.test(idStr)) {
        return true;
    }

    try {
        const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
        const base = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");
        const pathId = encodeURIComponent(idStr);
        const st = encodeURIComponent(String(status));
        const res = await fetch(`${base}/tables/staff/tables/${pathId}/status?status=${st}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            console.warn("syncTableStatus: HTTP", res.status, idStr, status);
            return false;
        }
        return true;
    } catch (e) {
        console.warn("syncTableStatus:", e);
        return false;
    }
}

async function confirmBooking(id) {
    const r = reservations.find(x => x.id === id);
    try {
        await axiosInstance.patch(`/staff/reservations/${id}/confirm`);
        const synced = await syncTableStatus(r?.tableId, "RESERVED");
        if (!synced) {
            alert(
                "Đặt chỗ đã được xác nhận nhưng không đồng bộ được trạng thái bàn (RESERVED). " +
                    "Kiểm tra quyền, mạng hoặc cập nhật bàn thủ công nếu cần."
            );
        }
    } catch (err) {
        handleError(err);
        return;
    }
    loadReservations();
}

async function confirmArrival(id) {
    const r = reservations.find(x => x.id === id);
    let tableId =
        r?.tableId != null && Number(r.tableId) > 0 ? Number(r.tableId) : null;

    /** id từ API có thể cũ (bàn đổi/nhập tay) → kiểm tra với ds bàn hiện tại */
    if (tableId != null && !staffTables.some((x) => Number(x.id) === tableId)) {
        tableId = null;
        if (!staffTables.length) {
            alert("Không tải được danh sách bàn. Tải lại trang rồi thử Khách đã đến.");
            await loadStaffTables();
            return;
        }
    }

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
        const synced = await syncTableStatus(tableId, "OCCUPIED");
        if (!synced) {
            alert(
                "Đã ghi nhận khách đến nhưng không đồng bộ được trạng thái bàn (OCCUPIED). " +
                    "Kiểm tra mạng hoặc mục Quản lý bàn."
            );
        }
        loadReservations();
    } catch (err) {
        handleError(err);
    }
}

async function completeBooking(id) {
    const r = reservations.find(x => x.id === id);
    try {
        await axiosInstance.patch(`/staff/reservations/${id}/complete`);
        const synced = await syncTableStatus(r?.tableId, "CLEANING");
        if (!synced) {
            alert(
                "Đặt chỗ đã hoàn thành nhưng không đồng bộ được trạng thái bàn (CLEANING). " +
                    "Kiểm tra quyền, mạng hoặc cập nhật bàn thủ công nếu cần."
            );
        }
    } catch (err) {
        handleError(err);
        return;
    }
    loadReservations();
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


function setupSearch() {
    const input = document.querySelector(".search-input");
    if (!input) return;
    input.addEventListener("input", applyFilters);
}

function applyFilters() {
    const input = document.querySelector(".search-input");
    const val = String(input?.value || "").toLowerCase();
    filteredRows = reservations.filter((r) => {
        const matchSearch = !val ||
            (r.customerName || "").toLowerCase().includes(val) ||
            String(r.customerPhone || "").includes(val);
        const matchStatus = !statusFilter ||
            normalizeReservationStatus(r.status) === statusFilter;
        return matchSearch && matchStatus;
    });
    currentPage = 1;
    redrawList();
    updateStats(reservations);
}

function setupStatusFilter() {
    document.getElementById("btnFilter")
        ?.closest(".dropdown")
        ?.querySelectorAll("[data-status]")
        ?.forEach((item) => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                statusFilter = item.dataset.status || "";
                item.closest("ul")?.querySelectorAll(".dropdown-item")?.forEach((el) => el.classList.remove("active"));
                item.classList.add("active");
                applyFilters();
            });
        });
}

function exportCSV() {
    const statusLabel = {
        CONFIRMED: "Đã xác nhận",
        PENDING: "Chờ xử lý",
        ARRIVED: "Đã đến",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy"
    };
    const headers = ["Tên khách", "Số điện thoại", "Số khách", "Thời gian", "Vị trí / Bàn", "Trạng thái"];
    const rows = filteredRows.map((r) => {
        const dt = parseReservationDate(r.reservationTime);
        const time = dt ? dt.toLocaleString("vi-VN") : "";
        const loc = r.tableNumber
            ? `${r.tableNumber}${r.tableLocation ? " - " + r.tableLocation : ""}`
            : "";
        const st = normalizeReservationStatus(r.status);
        return [
            r.customerName || "",
            r.customerPhone || "",
            r.numberOfGuests || 0,
            time,
            loc,
            statusLabel[st] || r.status || ""
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
    a.download = `datcho_${selectedDate || formatInputDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function resetStatusFilterToAll() {
    statusFilter = "";
    const dropdown = document.getElementById("btnFilter")?.closest(".dropdown");
    if (!dropdown) return;
    dropdown.querySelectorAll("[data-status]").forEach((item) => {
        item.classList.toggle("active", (item.dataset.status || "") === "");
    });
}

function initDateFilter() {
    const input = document.getElementById("filterDate");
    const btnToday = document.getElementById("btnToday");
    if (!input) return;

    input.value = selectedDate;

    input.addEventListener("change", () => {
        selectedDate = input.value || formatInputDate(new Date());
        resetStatusFilterToAll();
        loadReservations();
    });

    btnToday?.addEventListener("click", () => {
        selectedDate = formatInputDate(new Date());
        input.value = selectedDate;
        resetStatusFilterToAll();
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

/** Chuẩn hoá giá trị `datetime-local` (yyyy-MM-ddTHH:mm hoặc có giây) thành LocalDateTime ISO gửi API. */
function normalizeDatetimeLocalForApi(raw) {
    if (!raw || typeof raw !== "string") return null;
    const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const sec = m[6] != null && m[6] !== "" ? m[6] : "00";
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${sec}`;
}

/** Parse yyyy-MM-ddTHH:mm:ss như giờ địa phương (datetime-local), không dùng `new Date(string)`. */
function parseDatetimeLocalNormalizedToDate(normalizedIsoLocal) {
    if (!normalizedIsoLocal || typeof normalizedIsoLocal !== "string") return null;
    const m = normalizedIsoLocal.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const s = Number(m[6]);
    if (mo < 0 || mo > 11 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    const dt = new Date(y, mo, d, h, mi, s);
    if (isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dt;
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

    const msg = err.response?.data?.message || err.response?.data?.error || err.message || "Lỗi server";
    const status = err.response?.status ? ` (${err.response.status})` : "";
    alert(msg + status);
}

/** Một instance Bootstrap Modal cho `#editModal` (getOrCreateInstance — tránh lỗi khi khởi tạo lặp `new Modal`). */
function getEditModalBootstrap() {
    const el = document.getElementById("editModal");
    if (!el || typeof bootstrap === "undefined") return null;
    return bootstrap.Modal.getOrCreateInstance(el);
}

function openAddNew() {
    document.getElementById("editId").value = "";
    document.getElementById("editName").value = "";
    document.getElementById("editPhone").value = "";
    document.getElementById("editGuests").value = "2";
    document.getElementById("editTime").value = "";

    refillEditTableSelect();
    const sel = document.getElementById("editTableId");
    if (sel) sel.value = "";

    const statusSel = document.getElementById("editStatus");
    if (statusSel) statusSel.value = "PENDING";

    document.getElementById("editStatusWrap")?.classList.add("d-none");

    const badge = document.getElementById("editModalMode");
    if (badge) badge.classList.remove("d-none");

    document.getElementById("btnSaveReservation").textContent = "Thêm mới";

    getEditModalBootstrap()?.show();
}

function openEdit(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById("editStatusWrap")?.classList.remove("d-none");

    const badge = document.getElementById("editModalMode");
    if (badge) badge.classList.add("d-none");

    document.getElementById("btnSaveReservation").textContent = "Lưu thay đổi";

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

    const statusSel = document.getElementById("editStatus");
    if (statusSel) statusSel.value = normalizeReservationStatus(r.status) || "PENDING";

    getEditModalBootstrap()?.show();
}
async function updateReservation() {
    const id = document.getElementById("editId").value;
    const saveBtn = document.getElementById("btnSaveReservation");

  
    if (saveBtn && saveBtn.disabled) return;

    const rawTable = document.getElementById("editTableId")?.value;
    const tableId = rawTable ? Number(rawTable) : null;

    const nameRaw = document.getElementById("editName").value.trim();
    const phoneRaw = document.getElementById("editPhone").value.trim();
    const guestsTrim = String(document.getElementById("editGuests")?.value ?? "").trim();
    const guestsRaw = parseInt(guestsTrim, 10);
    const timeRaw = document.getElementById("editTime").value;

    if (!nameRaw || !phoneRaw || !timeRaw || guestsTrim === "") {
        alert("Vui lòng nhập đầy đủ tên, số điện thoại, thời gian và số khách.");
        return;
    }

    if (!/^[\p{L}\s]+$/u.test(nameRaw)) {
        alert("Tên khách hàng chỉ được chứa chữ cái và khoảng trắng.");
        return;
    }

    const phoneClean = phoneRaw.replace(/\s/g, "");
    if (!/^(0[0-9]{8,10}|\+84[0-9]{8,10})$/.test(phoneClean)) {
        alert(
            "Số điện thoại \"" +
                phoneRaw +
                "\" không đúng định dạng. Vui lòng nhập số Việt Nam (VD: 0912345678, 09876543210 hoặc +84912345678)."
        );
        return;
    }

    if (!Number.isFinite(guestsRaw)) {
        alert("Số khách không hợp lệ (chỉ nhập số).");
        return;
    }
    if (guestsRaw < 1 || guestsRaw > 100) {
        alert("Vui lòng nhập số khách từ 1 đến 100.");
        return;
    }

    
    const timeValNorm = normalizeDatetimeLocalForApi(timeRaw);
    if (!timeValNorm) {
        alert("Thời gian không đúng định dạng. Vui lòng chọn ngày giờ đầy đủ (giờ:phút).");
        return;
    }

    if (!id) {
        const selectedTime = parseDatetimeLocalNormalizedToDate(timeValNorm);
        if (!selectedTime) {
            alert("Thời gian không đúng định dạng. Vui lòng chọn ngày giờ đầy đủ (giờ:phút).");
            return;
        }
        if (selectedTime.getTime() <= Date.now()) {
            alert("Thời gian đặt bàn không hợp lệ. Chỉ được đặt cho thời điểm trong tương lai.");
            return;
        }
        const h = selectedTime.getHours();
        if (!(h >= 7 && h <= 23)) {
            alert("Thời gian đặt bàn ngoài giờ hoạt động (7:00 – 23:59). Vui lòng chọn lại.");
            return;
        }
    }

    const data = {
        customerName: nameRaw,
        customerPhone: phoneRaw,
        numberOfGuests: guestsRaw,
        reservationTime: timeValNorm,
        tableId: rawTable !== "" && Number.isFinite(tableId) ? tableId : null,
        status: document.getElementById("editStatus")?.value || "PENDING"
    };

    if (saveBtn) saveBtn.disabled = true;
    try {
        if (id) {
            await axiosInstance.put(`/reservations/${id}`, data);
            alert("Cập nhật thành công");
        } else {
            // Tạo mới: không truyền status — backend luôn tạo PENDING (UI không hiện ô trạng thái khi thêm mới)
            const createData = {
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                numberOfGuests: data.numberOfGuests,
                reservationTime: data.reservationTime,
                tableId: data.tableId
            };
            await axiosInstance.post(`/reservations`, createData);
            alert("Thêm đặt chỗ thành công");

            const newDay = String(data.reservationTime).slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(newDay)) {
                selectedDate = newDay;
                const fd = document.getElementById("filterDate");
                if (fd) fd.value = selectedDate;
            }
        }

        loadReservations();

        getEditModalBootstrap()?.hide();

    } catch (err) {
        handleError(err);
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}
function normalizeReservationStatus(raw) {
    return String(raw == null ? "" : raw).trim().toUpperCase();
}

// ================= CALENDAR VIEW (FUNC_BOOKING_05/06) =================
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth(); // 0-indexed

function switchView(view) {
    const listSection = document.getElementById("listViewSection");
    const calSection = document.getElementById("calendarView");
    const tabList = document.getElementById("tabList");
    const tabCal = document.getElementById("tabCalendar");
    if (view === "calendar") {
        listSection?.classList.add("d-none");
        calSection?.classList.remove("d-none");
        tabList?.classList.remove("active");
        tabCal?.classList.add("active");
        const d = new Date(`${selectedDate}T12:00:00`);
        calendarYear = d.getFullYear();
        calendarMonth = d.getMonth();
        renderCalendarGrid();
    } else {
        listSection?.classList.remove("d-none");
        calSection?.classList.add("d-none");
        tabList?.classList.add("active");
        tabCal?.classList.remove("active");
    }
}

function calendarPrev() {
    if (calendarMonth === 0) { calendarMonth = 11; calendarYear--; }
    else calendarMonth--;
    renderCalendarGrid();
}

function calendarNext() {
    if (calendarMonth === 11) { calendarMonth = 0; calendarYear++; }
    else calendarMonth++;
    renderCalendarGrid();
}

function renderCalendarGrid() {
    const label = document.getElementById("calendarMonthLabel");
    const grid = document.getElementById("calendarGrid");
    if (!label || !grid) return;

    const monthNames = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
    label.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    const dayLabels = ["CN","T2","T3","T4","T5","T6","T7"];
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const todayStr = formatInputDate(new Date());

    // Build set of dates with reservations
    const bookedDates = new Set();
    reservations.forEach(r => {
        const d = parseReservationDate(r.reservationTime);
        if (d) bookedDates.add(formatInputDate(d));
    });

    let html = '<div class="cal-grid">';
    dayLabels.forEach(d => { html += `<div class="cal-cell cal-hdr">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const cls = [
            "cal-cell cal-day",
            dateStr === todayStr ? "cal-today" : "",
            dateStr === selectedDate ? "cal-selected" : "",
            bookedDates.has(dateStr) ? "cal-has-booking" : ""
        ].filter(Boolean).join(" ");
        html += `<div class="${cls}" onclick="calendarSelectDay('${dateStr}')">${day}${bookedDates.has(dateStr) ? '<span class="cal-dot"></span>' : ''}</div>`;
    }
    html += '</div>';
    grid.innerHTML = html;
}

function calendarSelectDay(dateStr) {
    selectedDate = dateStr;
    const fi = document.getElementById("filterDate");
    if (fi) fi.value = dateStr;
    resetStatusFilterToAll();
    loadReservations();
    switchView("list");
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
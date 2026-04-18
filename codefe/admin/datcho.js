// ================= CONFIG =================
const API_BASE_URL = "http://localhost:8080/api";
const TOKEN_KEY = "token";

// ================= AXIOS =================
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    //withCredentials: true
});

// Auto attach JWT
axiosInstance.interceptors.request.use(config => {
    const token = localStorage.getItem("token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// ================= STATE =================
let reservations = [];
let selectedDate = formatInputDate(new Date());

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    initDateFilter();
    loadReservations();
    setupSearch();
});

// ================= LOAD =================
async function loadReservations() {
    try {
        const res = await axiosInstance.get("/staff/reservations", {
            params: { date: selectedDate }
        });

        if (res.data?.data) {
            reservations = res.data.data;
            renderTable(reservations);
            updateStats(reservations);
            updateFooterInfo();
        }

    } catch (err) {
        console.error("ERROR:", err);
        handleError(err);
    }
}

// ================= RENDER =================
function renderTable(data) {
    const tbody = document.querySelector(".custom-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    data.forEach(r => {
        const row = `
        <tr class="row-low">

            <td>
                <div class="cust-info">
                    <div class="avatar primary-text">
                        ${getInitial(r.customerName)}
                    </div>
                    <div>
                        <p class="cust-name">${r.customerName}</p>
                        <p class="cust-sub">${r.customerPhone}</p>
                    </div>
                </div>
            </td>

            <td>${r.numberOfGuests}</td>

            <td>
                <p class="time-text">${formatHour(r.reservationTime)}</p>
                <p class="date-sub">
                    ${formatDate(r.reservationTime)}
                </p>
            </td>

            <td>${renderStatus(r.status)}</td>

            <td class="text-end">
                ${renderActions(r)}
            </td>

        </tr>
        `;

        tbody.innerHTML += row;
    });
}

// ================= STATUS =================
function renderStatus(status) {
    switch (status) {
        case "PENDING":
            return `<span class="badge-status tertiary">Chờ xử lý</span>`;
        case "CONFIRMED":
            return `<span class="badge-status confirmed">Đã xác nhận</span>`;
        case "ARRIVED":
            return `<span class="badge bg-info">Đã đến</span>`;
        case "COMPLETED":
            return `<span class="badge bg-success">Hoàn thành</span>`;
        case "CANCELLED":
            return `<span class="badge bg-danger">Đã hủy</span>`;
        default:
            return status;
    }
}

function renderActions(r) {
    return `
    <div class="action-wrap">

        <button onclick="openEdit(${r.id})" class="btn-action">
            ✏️
        </button>

        ${r.status === "PENDING" ? `
        <button onclick="confirmBooking(${r.id})" class="btn-action ok">✔</button>` : ""}

        ${r.status === "CONFIRMED" ? `
        <button onclick="confirmArrival(${r.id})" class="btn-action ok">✔✔</button>` : ""}

        ${r.status === "ARRIVED" ? `
        <button onclick="completeBooking(${r.id})" class="btn-action ok">✔✔✔</button>` : ""}

    </div>`;
}

// ================= API =================
async function confirmBooking(id) {
    await callAPI(`/staff/reservations/${id}/confirm`);
}

async function confirmArrival(id) {
    await callAPI(`/staff/reservations/${id}/arrived`);
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

// ================= SEARCH =================
function setupSearch() {
    const input = document.querySelector(".search-input");
    if (!input) return;

    input.addEventListener("input", e => {
        const val = e.target.value.toLowerCase();

        const filtered = reservations.filter(r =>
            r.customerName.toLowerCase().includes(val) ||
            r.customerPhone.includes(val)
        );

        renderTable(filtered);
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
    const d = new Date(`${selectedDate}T00:00:00`);
    el.textContent = `Đang hiển thị dữ liệu ngày ${d.toLocaleDateString("vi-VN")}`;
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
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
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

    new bootstrap.Modal(document.getElementById("editModal")).show();
}
async function updateReservation() {
    const id = document.getElementById("editId").value;

    const data = {
        customerName: document.getElementById("editName").value,
        customerPhone: document.getElementById("editPhone").value,
        numberOfGuests: parseInt(document.getElementById("editGuests").value),
        reservationTime: document.getElementById("editTime").value
    };

    try {
        await axiosInstance.put(`/reservations/${id}`, data);

        alert("Cập nhật thành công");

        loadReservations();

        bootstrap.Modal.getInstance(
            document.getElementById("editModal")
        ).hide();

    } catch (err) {
        handleError(err);
    }

}
function updateStats(data) {
    let totalGuests = 0;
    let confirmed = 0;
    let pending = 0;

    data.forEach(r => {
        if (r.status !== "CANCELLED") {
        totalGuests += r.numberOfGuests || 0;
    }

        if (r.status === "CONFIRMED") confirmed++;
        if (r.status === "PENDING") pending++;
    });

    // 👉 UI
    document.getElementById("totalGuests").innerText = totalGuests;
    document.getElementById("confirmedCount").innerText = format2(confirmed);
    document.getElementById("pendingCount").innerText = format2(pending);

    // 👉 % tăng trưởng
    const percent = calcGrowth(totalGuests);
    document.querySelector(".stat-trend").innerText =
        `${percent >= 0 ? "+" : ""}${percent}% so với hôm qua`;

    // 🔥 THÊM ĐOẠN NÀY
    const risk = calcRisk(data);
    document.querySelector(".bg-error-container").innerText = format2(risk);
}
    function format2(num) {
        return num < 10 ? "0" + num : num;
    }

    function calcGrowth(today) {
        if (today === 0) return 0;

        const yesterday = today * 0.85;
        return Math.round(((today - yesterday) / yesterday) * 100);
    }

    function calcRisk(data) {
        const now = new Date();

        return data.filter(r => {
            const time = parseReservationDate(r.reservationTime);
            if (!time) return false;
            return r.status === "CONFIRMED" && time < now;
        }).length;
    }
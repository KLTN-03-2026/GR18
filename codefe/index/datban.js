/**
 * Project: Restaurant AI - Nhóm 18
 * Đặt bàn trực tuyến — khu vực & bàn từ API /tables/booking-options
 */

const LOGIN_PAGE = "../dangnhap.html";
const AFTER_LOGIN_PATH = "index/datban.html";
const API_BASE = (typeof window !== "undefined" && window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");

let bookingLocations = [];
let bookingTables = [];

function getAccessToken() {
    return localStorage.getItem("accessToken") || localStorage.getItem("token");
}

function redirectToLogin() {
    const next = encodeURIComponent(AFTER_LOGIN_PATH);
    window.location.href = `${LOGIN_PAGE}?next=${next}`;
}

function toastOk(msg, title) {
    if (typeof toastr !== "undefined") toastr.success(msg, title || "Thành công");
    else alert((title ? title + ": " : "") + msg);
}
function toastErr(msg) {
    if (typeof toastr !== "undefined") toastr.error(msg, "Lỗi");
    else alert("Lỗi: " + msg);
}
function toastWarn(msg) {
    if (typeof toastr !== "undefined") toastr.warning(msg);
    else alert(msg);
}

function escAttr(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

function fallbackLocationMarkup() {
    return `
    <input type="radio" class="btn-check" name="area" id="loc-any" value="" autocomplete="off" checked />
    <label class="btn btn-outline-secondary btn-sm rounded-pill px-3" for="loc-any">Tùy nhà hàng sắp xếp</label>
    <input type="radio" class="btn-check" name="area" id="outdoor" value="Ngoài trời" autocomplete="off" />
    <label class="btn btn-outline-secondary btn-sm rounded-pill px-3" for="outdoor">Ngoài trời</label>
    <input type="radio" class="btn-check" name="area" id="indoor" value="Trong nhà" autocomplete="off" />
    <label class="btn btn-outline-secondary btn-sm rounded-pill px-3" for="indoor">Trong nhà</label>
    <input type="radio" class="btn-check" name="area" id="vip" value="VIP" autocomplete="off" />
    <label class="btn btn-outline-secondary btn-sm rounded-pill px-3" for="vip">VIP</label>`;
}

function renderLocationOptions() {
    const wrap = document.getElementById("locationOptions");
    if (!wrap) return;

    if (!bookingLocations.length) {
        wrap.innerHTML = fallbackLocationMarkup();
    } else {
        const items = [
            `<input type="radio" class="btn-check" name="area" id="loc-any" value="" autocomplete="off" checked />`,
            `<label class="btn btn-outline-secondary btn-sm rounded-pill px-3" for="loc-any">Tùy nhà hàng</label>`
        ];
        bookingLocations.forEach((loc, i) => {
            const id = `loc-opt-${i}`;
            items.push(`<input type="radio" class="btn-check" name="area" id="${id}" value="${escAttr(loc)}" autocomplete="off" />`);
            items.push(
                `<label class="btn btn-outline-secondary btn-sm rounded-pill px-3" for="${id}">${escAttr(loc)}</label>`
            );
        });
        wrap.innerHTML = items.join("");
    }

    wrap.querySelectorAll('input[name="area"]').forEach((inp) => {
        inp.addEventListener("change", () => refillTablePreference());
    });

    refillTablePreference();
}

function selectedLocationValue() {
    const el = document.querySelector('input[name="area"]:checked');
    return el ? String(el.value || "").trim() : "";
}

function refillTablePreference() {
    const sel = document.getElementById("tablePreference");
    if (!sel) return;

    const loc = selectedLocationValue();
    const guestsEl = document.getElementById("guests");
    const minCap = guestsEl ? Number(guestsEl.value) || 1 : 1;

    const prev = sel.value;
    let list = bookingTables.slice();
    if (loc) {
        list = list.filter((t) => (t.location || "").trim() === loc);
    }
    list = list.filter((t) => (Number(t.capacity) || 0) >= minCap);

    sel.innerHTML =
        '<option value="">— Chưa chọn — nhà hàng sắp xếp</option>' +
        list
            .map((t) => {
                const locLabel = (t.location && String(t.location).trim()) || "—";
                return `<option value="${Number(t.id)}">Bàn ${escAttr(String(t.tableNumber))} · ${escAttr(locLabel)} (${Number(t.capacity)} chỗ)</option>`;
            })
            .join("");

    if (prev && list.some((t) => String(t.id) === prev)) sel.value = prev;
}

async function loadBookingOptions() {
    const wrap = document.getElementById("locationOptions");
    try {
        const res = await axios.get(`${API_BASE}/tables/booking-options`);
        const data = res.data?.data;
        if (data && res.data.success !== false) {
            bookingLocations = Array.isArray(data.locations) ? data.locations : [];
            bookingTables = Array.isArray(data.tables) ? data.tables : [];
            renderLocationOptions();
            return;
        }
    } catch (e) {
        console.warn("Không tải được booking-options:", e);
    }

    bookingLocations = [];
    bookingTables = [];
    if (wrap) wrap.innerHTML = fallbackLocationMarkup();
    const sel = document.getElementById("tablePreference");
    if (sel) sel.innerHTML = '<option value="">— Chưa chọn — nhà hàng sắp xếp</option>';
}

document.addEventListener("DOMContentLoaded", () => {
    if (typeof toastr !== "undefined") {
        toastr.options = { closeButton: true, progressBar: true, positionClass: "toast-top-right", timeOut: 4000 };
    }

    loadBookingOptions();

    const guestsEl = document.getElementById("guests");
    guestsEl?.addEventListener("input", refillTablePreference);

    const reservationForm = document.getElementById("reservationForm");
    const submitBtn = document.getElementById("submitBtn");
    const guestHint = document.getElementById("guest-login-hint");

    const token = getAccessToken();
    if (!token && guestHint) guestHint.classList.remove("d-none");

    if (reservationForm) {
        reservationForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const authToken = getAccessToken();
            if (!authToken) {
                alert("Vui lòng đăng nhập để xác nhận đặt bàn.");
                redirectToLogin();
                return;
            }

            const date = document.getElementById("resDate").value;
            const time = document.getElementById("resTime").value;
            const guests = document.getElementById("guests").value;
            const phoneEl = document.getElementById("customerPhone");
            const customerPhone = (phoneEl?.value || "").trim();
            const noteTxt = document.getElementById("note").value;
            const areaInput = document.querySelector('input[name="area"]:checked');
            const area = areaInput ? String(areaInput.value || "").trim() : "";

            const tableSel = document.getElementById("tablePreference");
            const rawTable = tableSel?.value;
            const tableId = rawTable ? Number(rawTable) : null;

            if (!customerPhone) {
                toastWarn("Vui lòng nhập số điện thoại liên hệ.");
                phoneEl?.focus();
                return;
            }

            const reservationTime = `${date}T${time}:00`;

            const noteParts = [];
            if (area) noteParts.push(`Khu vực mong muốn: ${area}`);
            const tableOpt = bookingTables.find((t) => t.id === tableId);
            if (tableOpt) noteParts.push(`Bàn mong muốn: ${tableOpt.tableNumber}`);
            if (noteTxt && noteTxt.trim()) noteParts.push(`Ghi chú: ${noteTxt.trim()}`);

            const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");

            const payload = {
                reservationTime,
                numberOfGuests: parseInt(guests, 10),
                customerName: userInfo.fullName || "Khách hàng",
                customerPhone,
                tableId: tableId && Number.isFinite(tableId) ? tableId : null,
                note: noteParts.length ? noteParts.join(". ") : null
            };

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

                const response = await axios.post(`${API_BASE}/reservations`, payload, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });

                if (response.data.success) {
                    toastOk("Hẹn gặp bạn vào " + new Date(reservationTime).toLocaleString("vi-VN"), "Đặt bàn thành công");
                    setTimeout(function () {
                        window.location.href = "lichsu.html";
                    }, 1500);
                }
            } catch (error) {
                console.error("Booking Error:", error);
                const message = error.response?.data?.message || "Đặt bàn thất bại. Vui lòng thử lại!";
                toastErr(message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Xác nhận đặt bàn";
            }
        });
    }
});

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

/** yyyy-MM-dd theo giờ local */
function formatInputDateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Ghép date (yyyy-MM-dd) + time (HH:mm) thành Date local; null nếu sai định dạng. */
function parseCombinedLocalDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const tm = String(timeStr).trim().match(/^(\d{2}):(\d{2})$/);
    const dm = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!tm || !dm) return null;
    const y = Number(dm[1]);
    const mo = Number(dm[2]) - 1;
    const day = Number(dm[3]);
    const h = Number(tm[1]);
    const mi = Number(tm[2]);
    if (mo < 0 || mo > 11 || day < 1 || day > 31 || h > 23 || mi > 59) return null;
    const dt = new Date(y, mo, day, h, mi, 0, 0);
    if (isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
    return dt;
}

/** Không cho chọn ngày quá khứ; mặc định hôm nay + giờ hiện tại nếu trống. */
function initReservationDateTimeInputs() {
    const dateEl = document.getElementById("resDate");
    const timeEl = document.getElementById("resTime");
    if (!dateEl) return;
    const today = formatInputDateLocal(new Date());
    dateEl.min = today;
    if (!dateEl.value || dateEl.value < today) {
        dateEl.value = today;
    }
    if (timeEl && !timeEl.value) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        timeEl.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
}

/**
 * Chuỗi reservationTime từ API là LocalDateTime (ISO không có offset).
 * Không dùng `new Date(iso)` trực tiếp — trình duyệt thường coi là UTC → lệch ngày/giờ VN.
 */
function formatApiReservationTimeVi(value) {
    if (value == null || value === "") return "";
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/);
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const day = Number(m[3]);
        const h = Number(m[4]);
        const mi = Number(m[5]);
        const sec = m[6] != null && m[6] !== "" ? Number(m[6]) : 0;
        if (h <= 23 && mi <= 59 && sec <= 59) {
            const d = new Date(y, mo, day, h, mi, sec, 0);
            if (!isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day) {
                return d.toLocaleString("vi-VN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                });
            }
        }
    }
    const d = new Date(s);
    return isNaN(d.getTime())
        ? s
        : d.toLocaleString("vi-VN", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
          });
}

/** Điền SĐT + email ô đặt bàn từ `userInfo` (sau đăng nhập), giống alias header khách. */
function prefillBookingContactFromUserInfo() {
    let u = {};
    try {
        u = JSON.parse(localStorage.getItem("userInfo") || "{}");
    } catch (e) {
        return;
    }
    const phone = String(u.phone || u.phoneNumber || u.mobile || "").trim();
    const email = String(u.email || u.mail || "").trim();
    const phoneEl = document.getElementById("customerPhone");
    const emailEl = document.getElementById("customerEmail");
    if (phoneEl && phone) phoneEl.value = phone;
    if (emailEl && email) emailEl.value = email;
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

    prefillBookingContactFromUserInfo();

    loadBookingOptions();

    initReservationDateTimeInputs();

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
                alert("Vui lòng đăng nhập để đặt bàn.");
                redirectToLogin();
                return;
            }

            const date = document.getElementById("resDate").value;
            const time = document.getElementById("resTime").value;
            const whenLocal = parseCombinedLocalDateTime(date, time);
            if (!whenLocal) {
                toastWarn("Vui lòng chọn đầy đủ ngày và giờ hợp lệ.");
                return;
            }
            if (whenLocal.getTime() <= Date.now()) {
                toastErr(
                    "Thời gian đặt bàn phải sau thời điểm hiện tại. Không được chọn ngày hoặc giờ đã qua."
                );
                return;
            }

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
            const customerEmail = (document.getElementById("customerEmail")?.value || "").trim();

            const payload = {
                reservationTime,
                numberOfGuests: parseInt(guests, 10),
                customerName: userInfo.fullName || "Khách hàng",
                customerPhone,
                tableId: tableId && Number.isFinite(tableId) ? tableId : null,
                note: noteParts.length ? noteParts.join(". ") : null
            };
            if (customerEmail) payload.customerEmail = customerEmail;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

                const response = await axios.post(`${API_BASE}/reservations`, payload, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });

                if (response.data.success) {
                    const d = response.data.data;
                    const serverMsg = response.data.message || "Đặt bàn thành công.";
                    toastOk(serverMsg, "Đặt bàn");
                    const idEl = document.getElementById("bookingSuccessId");
                    const detEl = document.getElementById("bookingSuccessDetail");
                    const hintEl = document.getElementById("bookingSuccessEmailHint");
                    if (idEl) idEl.textContent = d && d.id != null ? "#" + d.id : "—";
                    if (detEl && d) {
                        const segments = [];
                        if (d.reservationTime) {
                            const timeLabel = formatApiReservationTimeVi(d.reservationTime);
                            if (timeLabel) segments.push("Thời gian: " + timeLabel);
                        }
                        if (d.numberOfGuests != null) segments.push(d.numberOfGuests + " khách");
                        if (d.tableNumber)
                            segments.push(
                                "Bàn " +
                                    d.tableNumber +
                                    (d.tableLocation ? " (" + d.tableLocation + ")" : "")
                            );
                        detEl.textContent = segments.join(" · ") || "";
                    }
                    if (hintEl)
                        hintEl.textContent =
                            "Hệ thống đã gửi email xác nhận tới địa chỉ bạn nhập hoặc email tài khoản (nếu máy chủ đã cấu hình SMTP).";

                    var modalEl = document.getElementById("bookingSuccessModal");
                    if (modalEl && typeof bootstrap !== "undefined") {
                        bootstrap.Modal.getOrCreateInstance(modalEl).show();
                    }
                }
            } catch (error) {
                console.error("Booking Error:", error);
                const body = error.response?.data;
                const message =
                    body?.message ||
                    (typeof body?.error === "string" ? body.error : null) ||
                    error.message ||
                    "Đặt bàn thất bại. Vui lòng thử lại!";
                toastErr(message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Xác nhận đặt bàn";
            }
        });
    }
});

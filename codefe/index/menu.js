// ============================================================
// CONFIG (qr-session.js đặt RESTAURANT_API_BASE trước khi load file này)
// ============================================================
let API_BASE = window.RESTAURANT_API_BASE || "http://192.168.1.27:8080/api";
const API_BASE_CANDIDATES = [
    API_BASE,
    "http://192.168.1.27:8080/api",
    "http://localhost:8080/api",
    "http://127.0.0.1:8080/api"
];

/** Anh mac dinh + fallback: data URI (khong goi mang) tranh via.placeholder.com va vong lap onerror */
const MENU_IMAGE_FALLBACK =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
            '<rect fill="#e9ecef" width="80" height="80"/>' +
            '<text x="40" y="44" text-anchor="middle" font-size="11" fill="#6c757d" font-family="system-ui,sans-serif">No img</text>' +
            "</svg>"
    );

// State
let danhSachMon = [];
let monDangChon = null;
let _pageSize = 6;       // số món hiển thị mỗi lần
let _hienTai = 6;        // số món đang hiện
let _qrCategoryKey = "__all";
const DEMO_MENU = [
    { id: 9001, name: "Cơm chiên hải sản", price: 89000, avgRating: 4.5 },
    { id: 9002, name: "Mỳ Ý bò bằm", price: 99000, avgRating: 4.3 },
    { id: 9003, name: "Salad cá ngừ", price: 79000, avgRating: 4.2 },
    { id: 9004, name: "Trà đào cam sả", price: 45000, avgRating: 4.7 }
];

// ============================================================
// QR BÀN (khách vãng lai)
// ============================================================
function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
}

async function initQrBanner() {
    const el = document.getElementById("table-qr-banner");
    if (!el) return;
    const token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
    if (!token) {
        el.className =
            "alert alert-light border-bottom mb-0 rounded-0 py-2 small text-muted text-center";
        el.innerHTML =
            '<i class="fa-solid fa-qrcode me-1"></i>Quét mã QR tại bàn để đặt món đúng số bàn (thêm <code>?t=</code> token vào URL khi demo).';
        el.classList.remove("d-none");
        return;
    }
    try {
        const json = await fetchMenuWithFallback(`/tables/qr/${encodeURIComponent(token)}`);
        if (!json || json.success === false) throw new Error("invalid");
        const d = json.data != null ? json.data : json;
        el.className = "alert alert-success border-0 mb-0 rounded-0 py-2 text-center shadow-none";
        el.innerHTML =
            '<i class="fa-solid fa-chair me-2"></i><strong>Bàn ' +
            escapeHtml(d.tableNumber) +
            "</strong>" +
            (d.location ? " · " + escapeHtml(d.location) : "") +
            ' <span class="small opacity-75">— đã nhận diện bàn</span>';
        el.classList.remove("d-none");
    } catch (err) {
        console.error("QR validation error:", err);
        el.className = "alert alert-warning border-0 mb-0 rounded-0 py-2 text-center";
        el.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation me-2"></i>Không xác thực được mã bàn (BE hoặc token). Token: <code>' +
            escapeHtml(token) +
            '</code>';
        el.classList.remove("d-none");
    }
}

// ============================================================
// INIT
// ============================================================
window.onload = async () => {
    await initQrBanner();
    capNhatBadgeGioHang();
    loadMenu();

    const input = document.getElementById("searchInput");
    const icon = document.querySelector(".search-container .fa-magnifying-glass");

    let debounce;

    const handleSearch = () => {
        const keyword = input.value.trim();

        const sectionCombo  = document.getElementById("section-combo");
        const sectionSashimi = document.getElementById("section-sashimi");
        const sectionTatca  = document.getElementById("section-tatca");

        if (!keyword) {
            // Xoá kết quả tìm, hiện lại tất cả section gốc
            if (sectionCombo)   sectionCombo.style.display   = "";
            if (sectionSashimi) sectionSashimi.style.display = "";
            if (sectionTatca)   sectionTatca.style.display   = "";
            renderMenu(danhSachMon);
            return;
        }

        // Ẩn section tĩnh, chỉ giữ lại section kết quả tìm
        if (sectionCombo)   sectionCombo.style.display   = "none";
        if (sectionSashimi) sectionSashimi.style.display = "none";
        if (sectionTatca)   sectionTatca.style.display   = "";

        searchMenu(keyword);
    };

    input?.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(handleSearch, 300);
    });

    input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(debounce);
            handleSearch();
        }
    });

    icon?.addEventListener("click", handleSearch);

    document.addEventListener("click", (e) => {
        const panel = document.getElementById("qr-category-dropdown");
        const btn = document.getElementById("qr-cat-toggle-btn");
        if (!panel || panel.classList.contains("d-none")) return;
        if (panel.contains(e.target) || (btn && btn.contains(e.target))) return;
        closeQrCategoryDropdown();
    });
};

// ============================================================
// API
// ============================================================

// Load toàn bộ menu
async function loadMenu() {
    try {
        const json = await fetchMenuWithFallback("/menu");

        // FIX CHÍNH Ở ĐÂY
        danhSachMon = json.data || [];
        renderQrCategoryList(danhSachMon);

        renderMenu(danhSachMon);
    } catch (err) {
        console.error("Lỗi load menu:", err);
        danhSachMon = DEMO_MENU.slice();
        renderQrCategoryList(danhSachMon);
        renderMenu(danhSachMon);
        hienThongBao("Không tải được menu từ backend. Đang hiển thị dữ liệu demo. API hiện tại: " + API_BASE);
    }
}

// Search từ API
async function searchMenu(keyword) {
    try {
        const json = await fetchMenuWithFallback(`/menu/search?keyword=${encodeURIComponent(keyword)}`);

        // API search có content
        const data = json.data?.content || [];

        renderMenu(data);
    } catch (err) {
        console.error("Lỗi search:", err);
        hienThongBao("Lỗi tìm kiếm");
    }
}

async function fetchMenuWithFallback(path) {
    const deduped = [...new Set(API_BASE_CANDIDATES.filter(Boolean))];
    let lastErr;

    for (const base of deduped) {
        try {
            const res = await fetch(`${base}${path}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            API_BASE = base;
            window.RESTAURANT_API_BASE = base;
            return json;
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr || new Error("Không thể kết nối backend");
}
// ============================================================
// RENDER
// ============================================================
function renderMenu(items, reset) {
    const el = document.getElementById("menu-list");
    if (!el) return;
    const filteredItems = locTheoDanhMucQr(items || []);

    if (!filteredItems || filteredItems.length === 0) {
        el.innerHTML = `<p class="text-center text-muted">Không tìm thấy món ăn</p>`;
        _capNhatNutXemThem(0, 0);
        return;
    }

    if (reset !== false) _hienTai = _pageSize;  // reset khi load mới / search mới

    const hien = filteredItems.slice(0, _hienTai);

    el.innerHTML = `
        <div class="row g-4">
            ${hien.map(renderItem).join("")}
        </div>
    `;

    _capNhatNutXemThem(hien.length, filteredItems.length);
}

function _capNhatNutXemThem(hienTai, total) {
    const btn = document.getElementById("btn-xem-them");
    if (!btn) return;
    if (hienTai >= total) {
        btn.style.display = "none";
    } else {
        btn.style.display = "inline-block";
        btn.textContent = `Xem thêm (${total - hienTai} món còn lại)`;
    }
}

function xemThem() {
    _hienTai += _pageSize;
    renderMenu(danhSachMon, false);
    // scroll nhẹ xuống cuối danh sách
    document.getElementById("menu-list")?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
}

function renderItem(item) {
    const id = item.id;
    const ten = item.name || item.ten || "Món ăn";
    const gia = item.price || item.gia || 0;
    const rating = item.avgRating || item.rating || 0;

    const img = item.imageUrl || item.image || MENU_IMAGE_FALLBACK;

    return `
        <div class="col-md-6">
            <div class="menu-item-card d-flex align-items-center p-3 border rounded-3"
                onclick="xemChiTiet('${id}')"
                style="cursor:pointer">

                <img src="${img}" 
                     class="flex-shrink-0 me-3 rounded"
                     style="width:80px;height:80px;object-fit:cover"
                     alt=""
                     onerror="if(!this.dataset._fb){this.dataset._fb='1';this.onerror=null;this.src='${MENU_IMAGE_FALLBACK}';}">

                <div class="flex-grow-1">
                    <h5 class="fw-bold mb-1">${ten}</h5>
                    <div class="text-warning small mb-2">
                        ${renderStars(rating)}
                        <span class="text-muted">(${rating}/5)</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-orange">${formatVND(gia)}</span>
                        <button class="btn btn-outline-dark btn-sm rounded-circle"
                            onclick="event.stopPropagation(); moModal('${id}','${escapeStr(ten)}',${gia},'${escapeStr(img)}')">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function normalizeQrCategoryKey(input) {
    const s = String(input || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    return s || "khac";
}

function getItemCategoryLabel(item) {
    if (!item) return "Khác";
    if (typeof item.category === "string" && item.category.trim()) return item.category.trim();
    if (item.category && typeof item.category.name === "string" && item.category.name.trim()) return item.category.name.trim();
    if (typeof item.categoryName === "string" && item.categoryName.trim()) return item.categoryName.trim();
    return "Khác";
}

function locTheoDanhMucQr(items) {
    if (_qrCategoryKey === "__all") return items || [];
    return (items || []).filter((item) => normalizeQrCategoryKey(getItemCategoryLabel(item)) === _qrCategoryKey);
}

function renderQrCategoryList(items) {
    const root = document.getElementById("qr-category-list");
    if (!root) return;

    const seen = new Set();
    const categories = [{ key: "__all", label: "Tất cả món" }];
    (items || []).forEach((item) => {
        const label = getItemCategoryLabel(item);
        const key = normalizeQrCategoryKey(label);
        if (seen.has(key)) return;
        seen.add(key);
        categories.push({ key, label });
    });

    root.innerHTML = categories
        .map((c) => `
            <button type="button"
                    class="list-group-item list-group-item-action ${_qrCategoryKey === c.key ? "active" : ""}"
                    onclick="chonDanhMucQr('${escapeStr(c.key)}')">
                ${c.label}
            </button>
        `)
        .join("");
}

function chonDanhMucQr(key) {
    _qrCategoryKey = key || "__all";
    renderQrCategoryList(danhSachMon);
    renderMenu(danhSachMon);
    closeQrCategoryDropdown();
}

function toggleQrCategoryDropdown() {
    const panel = document.getElementById("qr-category-dropdown");
    if (!panel) return;
    panel.classList.toggle("d-none");
}

function closeQrCategoryDropdown() {
    const panel = document.getElementById("qr-category-dropdown");
    if (!panel) return;
    panel.classList.add("d-none");
}
// ============================================================
// ACTION
// ============================================================
function xemChiTiet(id) {
    let q = `id=${encodeURIComponent(id)}&from=menu`;
    const t = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
    if (t) q += `&t=${encodeURIComponent(t)}`;
    window.location.href = `menu-detail.html?${q}`;
}

function moModal(id, ten, gia, img) {
    monDangChon = { id, ten, gia, img: img || '' };

    document.getElementById("modal-ten-mon").textContent = ten;
    document.getElementById("modal-gia-mon").textContent = formatVND(gia);
    document.getElementById("soLuong-input").value = 1;
    const ghiChuEl = document.getElementById("ghichu-input");
    if (ghiChuEl) ghiChuEl.value = "";

    new bootstrap.Modal("#soLuongModal").show();
}

function thayDoiSoLuong(delta) {
    const input = document.getElementById("soLuong-input");
    input.value = Math.max(1, Math.min(99, +input.value + delta));
}

function xacNhanThemGio() {
    if (!monDangChon) return;

    const soLuong = +document.getElementById("soLuong-input").value || 1;
    const ghiChu = (document.getElementById("ghichu-input")?.value || "").trim();

    themVaoGio(monDangChon, soLuong, ghiChu);

    bootstrap.Modal.getInstance(document.getElementById("soLuongModal"))?.hide();
}

// ============================================================
// CART
// ============================================================
function layGioHang() {
    if (typeof window.layGioHangChung === "function") return window.layGioHangChung();
    try {
        return JSON.parse(localStorage.getItem("gioHang")) || [];
    } catch {
        return [];
    }
}

function luuGioHang(cart) {
    if (typeof window.luuGioHangChung === "function") window.luuGioHangChung(cart);
    else localStorage.setItem("gioHang", JSON.stringify(cart || []));
}

function themVaoGio(item, soLuong, ghiChu) {
    const cart = layGioHang();
    ghiChu = ghiChu || "";

    // Cùng món + cùng ghi chú thì cộng số lượng, khác ghi chú thì thêm dòng mới
    const index = cart.findIndex(i => i.id == item.id && (i.ghiChu || "") === ghiChu);

    if (index >= 0) {
        cart[index].soLuong += soLuong;
    } else {
        const entry = { ...item, soLuong };
        if (ghiChu) entry.ghiChu = ghiChu;
        cart.push(entry);
    }

    luuGioHang(cart);
    capNhatBadgeGioHang();

    const ghiChuNote = ghiChu ? ` (${ghiChu})` : "";
    hienToast(`Đã thêm ${soLuong} "${item.ten}"${ghiChuNote}`);
}

function capNhatBadgeGioHang() {
    const badge = document.getElementById("cart-badge");
    if (!badge) return;

    const total = layGioHang().reduce((s, i) => s + i.soLuong, 0);

    badge.style.display = total > 0 ? "inline-block" : "none";
    badge.textContent = total > 99 ? "99+" : total;
}

// ============================================================
// UI
// ============================================================
function hienToast(msg) {
    const toast = document.getElementById("cart-toast");
    const text = document.getElementById("cart-toast-msg");

    text.textContent = msg;
    toast.style.display = "block";

    setTimeout(() => toast.style.display = "none", 2500);
}

function hienThongBao(msg) {
    alert(msg);
}

// ============================================================
// UTIL
// ============================================================
function formatVND(n) {
    return Number(n).toLocaleString("vi-VN") + " VND";
}

function escapeStr(str) {
    return str.replace(/'/g, "\\'");
}

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);

    return `
        ${'<i class="fa-solid fa-star"></i>'.repeat(full)}
        ${half ? '<i class="fa-solid fa-star-half-stroke"></i>' : ''}
        ${'<i class="fa-regular fa-star"></i>'.repeat(empty)}
    `;
}
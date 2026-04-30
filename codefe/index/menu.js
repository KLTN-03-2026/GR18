// ============================================================
// CONFIG (qr-session.js đặt RESTAURANT_API_BASE trước khi load file này)
// ============================================================
let API_BASE = window.RESTAURANT_API_BASE || "http://127.0.0.1:8080/api";
/** Cùng host với trang (LAN / điện thoại) ưu tiên sau RESTAURANT_API_BASE. */
function sameHostApiBases() {
    const h = typeof window !== "undefined" && window.location && window.location.hostname;
    if (!h || h === "localhost" || h === "127.0.0.1") return [];
    return [(window.location.protocol + "//" + h + ":8080/api").replace(/\/+$/, "")];
}
function getApiBaseCandidates() {
    const fromSession = (window.RESTAURANT_API_BASE || "").replace(/\/+$/, "");
    const set = new Set();
    if (fromSession) set.add(fromSession);
    sameHostApiBases().forEach(function (b) { set.add(b); });
    [API_BASE, "http://127.0.0.1:8080/api", "http://localhost:8080/api"]
        .filter(Boolean)
        .forEach(function (b) { set.add(b.replace(/\/+$/, "")); });
    return [...set];
}

/** Anh mac dinh + fallback: data URI (khong goi mang) tranh via.placeholder.com va vong lap onerror */
const MENU_IMAGE_FALLBACK =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
            '<rect fill="#e9ecef" width="80" height="80"/>' +
            '<text x="40" y="44" text-anchor="middle" font-size="11" fill="#6c757d" font-family="system-ui,sans-serif">No img</text>' +
            "</svg>"
    );

// State — phân trang client: lần đầu + mỗi lần "Xem thêm" (16 món / bước, 4 hàng × 4 cột trên desktop)
let danhSachMon = [];
let monDangChon = null;
let _pageSize = 16;
let _hienTai = 16;
let _qrCategoryKey = "__all";
const DEMO_MENU = [
    { id: 9001, name: "Combo gia đình 4 người", price: 490000, avgRating: 4.6, categoryName: "Combo Ưu Đãi" },
    { id: 9002, name: "Cơm chiên hải sản", price: 89000, avgRating: 4.5, categoryName: "Món Chính" },
    { id: 9003, name: "Mỳ Ý bò bằm", price: 99000, avgRating: 4.3, categoryName: "Món Chính" },
    { id: 9004, name: "Salad cá ngừ", price: 79000, avgRating: 4.2, categoryName: "Khai Vị" },
    { id: 9005, name: "Trà đào cam sả", price: 45000, avgRating: 4.7, categoryName: "Đồ Uống" }
];

// ============================================================
// QR BÀN
// ============================================================
function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
}

function getGreetingPartOfDay() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return { icon: "☀️", label: "Chào buổi sáng" };
    if (h >= 12 && h < 14) return { icon: "⛅", label: "Chào buổi trưa" };
    if (h >= 14 && h < 18) return { icon: "⛅", label: "Chào buổi chiều" };
    if (h >= 18 && h < 22) return { icon: "🌙", label: "Chào buổi tối" };
    return { icon: "🌙", label: "Chào buổi tối" };
}

function initQrLanding() {
    if (!document.getElementById("qr-landing")) return;
    const greetText = document.getElementById("qr-greet-text");
    const greetIcon = document.getElementById("qr-greet-icon");
    const btnNick = document.getElementById("btn-qr-nick");
    const staffBtn = document.getElementById("btn-qr-staff");
    if (!greetText && !staffBtn) return;
    const applyGreet = function () {
        const g = getGreetingPartOfDay();
        const nick = localStorage.getItem("qr_guest_nickname") || "Quý khách";
        if (greetIcon) greetIcon.textContent = g.icon;
        if (greetText) greetText.textContent = g.label + " " + nick;
    };
    applyGreet();
    if (btnNick) {
        btnNick.addEventListener("click", function () {
            var v = prompt("Tên gọi tại bàn (hiển thị ở lời chào):", localStorage.getItem("qr_guest_nickname") || "");
            if (v === null) return;
            v = (v || "").trim();
            if (v.length > 40) v = v.slice(0, 40);
            if (v) localStorage.setItem("qr_guest_nickname", v);
            else localStorage.removeItem("qr_guest_nickname");
            applyGreet();
        });
    }
    if (staffBtn) {
        staffBtn.addEventListener("click", function () {
            qrCallStaffFromMenu();
        });
    }
}

function qrCallStaffFromMenu() {
    const token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
    if (!token) {
        hienToast("Vui lòng mở trang từ mã QR tại bàn.", "warning");
        return;
    }
    const base = (window.RESTAURANT_API_BASE || API_BASE || "http://127.0.0.1:8080/api").replace(/\/$/, "");
    fetch(base + "/call-staff/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token, note: "Khách bấm gọi nhân viên từ trang menu QR" })
    })
        .then(function (r) {
            return r.json().then(function (j) {
                return { ok: r.ok, j: j };
            });
        })
        .then(function (_a) {
            if (!_a.ok || _a.j.success === false) {
                throw new Error(_a.j.message || "Gửi thất bại");
            }
            hienToast("Đã gửi yêu cầu tới nhân viên.", "success");
        })
        .catch(function (e) {
            hienToast(e.message || "Không gửi được yêu cầu.", "warning");
        });
}

async function initQrBanner() {
    const el = document.getElementById("table-qr-banner");
    const pill = document.getElementById("qr-table-pill");
    const token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
    if (!token) {
        if (el) {
            el.classList.add("d-none");
            el.innerHTML = "";
        }
        if (pill) pill.textContent = "—";
        return;
    }
    try {
        const json = await fetchMenuWithFallback(`/tables/qr/${encodeURIComponent(token)}`);
        if (!json || json.success === false) throw new Error("invalid");
        const d = json.data != null ? json.data : json;
        if (pill) {
            pill.textContent = "Bàn " + (d.tableNumber != null ? d.tableNumber : "—");
            if (d.location) pill.setAttribute("title", d.location);
        }
        if (el) {
            if (pill) {
                el.classList.add("d-none");
                el.innerHTML = "";
            } else {
                el.className = "alert alert-success border-0 mb-0 rounded-0 py-2 text-center shadow-none";
                el.innerHTML =
                    '<i class="fa-solid fa-chair me-2"></i><strong>Bàn ' +
                    escapeHtml(d.tableNumber) +
                    "</strong>" +
                    (d.location ? " · " + escapeHtml(d.location) : "") +
                    ' <span class="small opacity-75">— đã nhận diện bàn</span>';
                el.classList.remove("d-none");
            }
        }
    } catch (err) {
        console.error("QR validation error:", err);
        const detail = err && err.message ? escapeHtml(String(err.message)) : "";
        if (pill) {
            pill.textContent = "—";
            pill.setAttribute("title", detail || "Chưa xác thực được bàn");
        }
        if (el) {
            if (pill) {
                el.classList.add("d-none");
            } else {
                el.className = "alert alert-warning border-0 mb-0 rounded-0 py-2 text-center small";
                el.innerHTML =
                    '<i class="fa-solid fa-triangle-exclamation me-2"></i>' +
                    (detail ? "<span class='d-block'>" + detail + "</span>" : "") +
                    '<span class="d-block mt-1">Token: <code>' +
                    escapeHtml(token) +
                    "</code> — In lại QR từ Admin nếu token đã đổi.</span>";
                el.classList.remove("d-none");
            }
        }
    }
}

// ============================================================
// INIT
// ============================================================
window.addEventListener("load", async () => {
    await initQrBanner();
    initQrLanding();
    if (typeof syncHeaderCartVisibility === "function") syncHeaderCartVisibility();
    capNhatBadgeGioHang();
    loadMenu();

    const input = document.getElementById("searchInput");
    const icon = document.querySelector(".search-container .fa-magnifying-glass");

    let debounce;

    const handleSearch = () => {
        const keyword = input.value.trim();

        const sectionCombo = document.getElementById("section-combo");
        const sectionSashimi = document.getElementById("section-sashimi");
        const sectionTatca = document.getElementById("section-tatca");

        if (!keyword) {
            if (sectionCombo) sectionCombo.style.display = "";
            if (sectionSashimi) sectionSashimi.style.display = "";
            if (sectionTatca) sectionTatca.style.display = "";
            renderMenu(danhSachMon);
            return;
        }

        if (sectionCombo) sectionCombo.style.display = "none";
        if (sectionSashimi) sectionSashimi.style.display = "none";
        if (sectionTatca) sectionTatca.style.display = "";

        searchMenu(keyword);
    };

    input?.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(handleSearch, 0);
    });

    input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(debounce);
            handleSearch();
        }
    });

    icon?.addEventListener("click", handleSearch);

    const urlQ = new URLSearchParams(window.location.search).get("q");
    if (urlQ && input) {
        input.value = urlQ;
        setTimeout(handleSearch, 400);
    }

    if (location.hash === "#menu-danhmuc") {
        setTimeout(
            () => document.getElementById("menu-danhmuc")?.scrollIntoView({ behavior: "smooth", block: "start" }),
            400
        );
    }

    document.addEventListener("click", (e) => {
        const panel = document.getElementById("qr-category-dropdown");
        const btn = document.getElementById("qr-cat-toggle-btn");
        if (!panel || panel.classList.contains("d-none")) return;
        if (panel.contains(e.target) || (btn && btn.contains(e.target))) return;
        closeQrCategoryDropdown();
    });
});

// ============================================================
// API
// ============================================================
function dedupByName(items) {
    const map = new Map();
    (items || []).forEach((item) => {
        const key = (item.name || item.ten || "").trim().toLowerCase();
        const existing = map.get(key);
        if (!existing) {
            map.set(key, item);
            return;
        }
        const hasImg = !!(item.imageUrl || item.image_url || item.image);
        const existHasImg = !!(existing.imageUrl || existing.image_url || existing.image);
        if (hasImg && !existHasImg) {
            map.set(key, item);
            return;
        }
        if (!hasImg && existHasImg) {
            return;
        }
        if ((item.id || 0) > (existing.id || 0)) map.set(key, item);
    });
    return [...map.values()];
}

async function loadMenu() {
    try {
        const json = await fetchMenuWithFallback("/menu");
        danhSachMon = sortMenuCombosAndMainsFirst(dedupByName(json.data || []));
        renderMenuCategoryTabs(danhSachMon);
        renderQrCategoryList(danhSachMon);
        renderMenu(danhSachMon);
    } catch (err) {
        console.error("Lỗi load menu:", err);
        danhSachMon = sortMenuCombosAndMainsFirst(DEMO_MENU.slice());
        renderMenuCategoryTabs(danhSachMon);
        renderQrCategoryList(danhSachMon);
        renderMenu(danhSachMon);
        hienThongBao("Không tải được menu từ backend. Đang hiển thị dữ liệu demo. API hiện tại: " + API_BASE);
    }
}

function searchMenu(keyword) {
    const q = keyword
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const filtered = sortMenuCombosAndMainsFirst(
        danhSachMon.filter((item) => {
            const name = (item.name || item.ten || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            return name.includes(q);
        })
    );

    renderMenu(filtered);
}

async function fetchMenuWithFallback(path) {
    const deduped = getApiBaseCandidates();
    let lastErr;

    for (const base of deduped) {
        try {
            const res = await fetch(`${base}${path}`);
            let json;
            try {
                const t = await res.text();
                json = t ? JSON.parse(t) : {};
            } catch (parseErr) {
                if (!res.ok) {
                    throw new Error("HTTP " + res.status + " (không đọc được JSON)");
                }
                throw parseErr;
            }
            if (!res.ok) {
                throw new Error((json && json.message) || "HTTP " + res.status);
            }
            if (json && json.success === false) {
                throw new Error(json.message || "Lỗi từ server");
            }
            API_BASE = base;
            window.RESTAURANT_API_BASE = base;
            return json;
        } catch (err) {
            lastErr = err;
        }
    }
    if (!lastErr) throw new Error("Không thể kết nối backend");
    const m = String(lastErr.message || "");
    if (/Failed to fetch|NetworkError|Load failed|không đọc được JSON/i.test(m)) {
        throw new Error(
            m +
                " — Backend: http://" +
                (window.location.hostname || "127.0.0.1") +
                ":8080/api (cùng Wi‑Fi, mở firewall cổng 8080 nếu cần)."
        );
    }
    throw lastErr;
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
        updateMenuFilterHeader(0);
        return;
    }

    if (reset !== false) _hienTai = _pageSize;

    const hien = filteredItems.slice(0, _hienTai);

    el.innerHTML = `
        <div class="row g-3">
            ${hien.map(renderItem).join("")}
        </div>
    `;

    _capNhatNutXemThem(hien.length, filteredItems.length);
    updateMenuFilterHeader(filteredItems.length);
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
    renderMenu(getBaseItemsForView(), false);
    document.getElementById("menu-list")?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
}

function toDirectImageUrl(url) {
    if (!url) return null;
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
    return url;
}

/** Chỉ menu.html: ẩn nút + thêm nhanh; qr-menu.html vẫn giữ nút. */
function isMenuListingPageOnly() {
    const p = window.location.pathname || "";
    return /(^|\/)menu\.html$/i.test(p);
}

function renderItem(item) {
    const id = item.id;
    const ten = item.name || item.ten || "Món ăn";
    const gia = item.price || item.gia || 0;
    const rating = item.avgRating || item.rating || 0;
    const desc = item.description || item.moTa || "";

    const rawImg = item.imageUrl || item.image_url || item.image || null;
    const img = toDirectImageUrl(rawImg) || null;

    const imgHtml = img
        ? `<img src="${img}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=&quot;menu-card-no-img&quot;><i class=&quot;fa-solid fa-bowl-food&quot;></i></div>'">`
        : `<div class="menu-card-no-img"><i class="fa-solid fa-bowl-food"></i></div>`;

    const ratingHtml =
        rating > 0
            ? `<div class="menu-card-rating"><i class="fa-solid fa-star"></i>${Number(rating).toFixed(1)}</div>`
            : "";

    const descTrim = String(desc || "").trim();
    const descHtml = descTrim
        ? `<div class="menu-card-desc">${escapeHtml(descTrim)}</div>`
        : "";

    return `
        <div class="col-6 col-md-4 col-lg-3">
            <div class="menu-card" onclick="xemChiTiet('${id}')">
                <div class="menu-card-img">
                    ${imgHtml}
                    ${ratingHtml}
                </div>
                <div class="menu-card-body">
                    <div class="menu-card-name">${escapeHtml(ten)}</div>
                    ${descHtml}
                    <div class="menu-card-footer">
                        <span class="menu-card-price">${formatVND(gia)}</span>
                        ${
                            isMenuListingPageOnly()
                                ? ""
                                : `<button type="button" class="menu-card-btn"
                            onclick="event.stopPropagation(); moModalById(${id})" title="Thêm nhanh">
                            <i class="fa-solid fa-plus"></i>
                        </button>`
                        }
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

/** Chuẩn hoá để so khớp tiếng Việt không dấu */
function _normSort(s) {
    return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Thứ tự hiển thị: 0 = Combo (danh mục/tên có combo, ưu đãi, set), 1 = Món chính, 2 = còn lại.
 * Khớp category mẫu DB: "Món Chính", "COMBO ƯU ĐÃI", v.v.
 */
function menuDisplayGroup(item) {
    const cat = _normSort(getItemCategoryLabel(item));
    const tit = _normSort(item.name || item.ten || "");
    const blob = cat + " " + tit;
    if (blob.includes("combo") || blob.includes("uu dai") || /\bset\b/.test(blob)) return 0;
    if (cat.includes("mon chinh")) return 1;
    return 2;
}

function sortMenuCombosAndMainsFirst(items) {
    if (!items || !items.length) return items;
    return [...items].sort((a, b) => {
        const ga = menuDisplayGroup(a);
        const gb = menuDisplayGroup(b);
        if (ga !== gb) return ga - gb;
        const na = (a.name || a.ten || "").toLowerCase();
        const nb = (b.name || b.ten || "").toLowerCase();
        return na.localeCompare(nb, "vi");
    });
}

function locTheoDanhMucQr(items) {
    if (_qrCategoryKey === "__all") return items || [];
    return (items || []).filter((item) => normalizeQrCategoryKey(getItemCategoryLabel(item)) === _qrCategoryKey);
}

/** Tập món gốc khi tìm kiếm (để lọc danh mục + 'Xem thêm' đúng trang hiện tại) */
function getBaseItemsForView() {
    const input = document.getElementById("searchInput");
    const kw = (input && input.value.trim()) || "";
    if (!kw) return danhSachMon;
    const q = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    return sortMenuCombosAndMainsFirst(
        danhSachMon.filter((item) => {
            const name = (item.name || item.ten || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            return name.includes(q);
        })
    );
}

function updateMenuFilterHeader(filteredTotal) {
    const titleEl = document.getElementById("menu-filter-title");
    const countEl = document.getElementById("menu-item-count");
    if (!titleEl || !countEl) return;
    const input = document.getElementById("searchInput");
    const kw = (input && input.value.trim()) || "";
    let title = "Tất cả món";
    if (kw) title = "Kết quả tìm kiếm";
    else if (_qrCategoryKey !== "__all") {
        const found = (danhSachMon || []).find(
            (i) => normalizeQrCategoryKey(getItemCategoryLabel(i)) === _qrCategoryKey
        );
        title = found ? getItemCategoryLabel(found) : "Danh mục";
    }
    titleEl.textContent = title;
    countEl.textContent = `${filteredTotal} món`;
}

function renderMenuCategoryTabs(products) {
    const bar = document.getElementById("menu-cat-tab-bar");
    if (!bar) return;
    const seen = new Set();
    const rows = [];
    (products || []).forEach((item) => {
        const label = getItemCategoryLabel(item);
        const key = normalizeQrCategoryKey(label);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ key, label });
    });
    rows.sort((a, b) => {
        const ga = menuDisplayGroup({ categoryName: a.label, name: "" });
        const gb = menuDisplayGroup({ categoryName: b.label, name: "" });
        if (ga !== gb) return ga - gb;
        return a.label.localeCompare(b.label, "vi");
    });
    const allActive = _qrCategoryKey === "__all" ? "active" : "";
    let html = `<button type="button" class="cat-tab ${allActive}" data-filter="__all" onclick="chonMenuCategoryTab(this)"><i class="fa-solid fa-border-all me-1"></i>Tất cả</button>`;
    rows.forEach(({ key, label }) => {
        const act = _qrCategoryKey === key ? "active" : "";
        html += `<button type="button" class="cat-tab ${act}" data-filter="${escapeHtml(
            key
        )}" onclick="chonMenuCategoryTab(this)">${escapeHtml(label)}</button>`;
    });
    bar.innerHTML = html;
}

function chonMenuCategoryTab(el) {
    if (!el) return;
    const f = el.getAttribute("data-filter");
    _qrCategoryKey = f == null || f === "" ? "__all" : f;
    const input = document.getElementById("searchInput");
    if (input) input.value = "";
    const bar = document.getElementById("menu-cat-tab-bar");
    if (bar) {
        bar.querySelectorAll(".cat-tab").forEach((b) => b.classList.toggle("active", b === el));
    }
    renderQrCategoryList(danhSachMon);
    renderMenu(getBaseItemsForView());
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
        .map(
            (c) => `
            <button type="button"
                    class="list-group-item list-group-item-action ${_qrCategoryKey === c.key ? "active" : ""}"
                    onclick="chonDanhMucQr('${escapeStr(c.key)}')">
                ${c.label}
            </button>
        `
        )
        .join("");
}

function chonDanhMucQr(key) {
    _qrCategoryKey = key || "__all";
    renderMenuCategoryTabs(danhSachMon);
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

function moModalById(id) {
    if (typeof getActiveQrToken === "function" && !getActiveQrToken()) {
        hienToast("Vui lòng quét mã QR tại bàn để thêm món vào giỏ.", "warning");
        return;
    }
    const item = danhSachMon.find((i) => String(i.id) === String(id));
    if (!item) return;
    const ten = item.name || item.ten || "Món ăn";
    const gia = item.price || item.gia || 0;
    const rawImg = item.imageUrl || item.image_url || item.image || null;
    const img = toDirectImageUrl(rawImg) || "";
    moModal(String(id), ten, gia, img);
}

function moModal(id, ten, gia, img) {
    monDangChon = { id, ten, gia, img: img || "" };

    document.getElementById("modal-ten-mon").textContent = ten;
    document.getElementById("modal-gia-mon").textContent = formatVND(gia);
    document.getElementById("soLuong-input").value = 1;
    const ghiChuEl = document.getElementById("ghichu-input");
    if (ghiChuEl) ghiChuEl.value = "";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("soLuongModal")).show();
}

function thayDoiSoLuong(delta) {
    const input = document.getElementById("soLuong-input");
    input.value = Math.max(1, Math.min(99, +input.value + delta));
}

function xacNhanThemGio() {
    if (!monDangChon) return;
    if (typeof getActiveQrToken === "function" && !getActiveQrToken()) {
        hienToast("Vui lòng quét mã QR tại bàn để đặt món.", "warning");
        return;
    }

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
    return [];
}

function luuGioHang(cart) {
    try {
        if (typeof window.luuGioHangChung === "function") window.luuGioHangChung(cart);
    } catch (e) {
        console.error("Không thể lưu giỏ hàng:", e);
    }
}

function themVaoGio(item, soLuong, ghiChu) {
    if (typeof getActiveQrToken === "function" && !getActiveQrToken()) {
        hienToast("Vui lòng quét mã QR tại bàn để thêm món vào giỏ.", "warning");
        return;
    }
    const cart = layGioHang();
    ghiChu = ghiChu || "";

    const index = cart.findIndex((i) => i.id == item.id && (i.ghiChu || "") === ghiChu);

    if (index >= 0) {
        cart[index].soLuong = Math.min(99, cart[index].soLuong + soLuong);
    } else {
        const entry = { ...item, soLuong: Math.min(99, soLuong) };
        if (ghiChu) entry.ghiChu = ghiChu;
        cart.push(entry);
    }

    luuGioHang(cart);
    capNhatBadgeGioHang();

    const ghiChuNote = ghiChu ? ` (${ghiChu})` : "";
    hienToast(`Đã thêm ${soLuong} "${item.ten}"${ghiChuNote}`, "success");
}

function capNhatBadgeGioHang() {
    const badge = document.getElementById("cart-badge");
    if (!badge) return;
    if (typeof getActiveQrToken === "function" && !getActiveQrToken()) {
        badge.style.display = "none";
        badge.textContent = "0";
        return;
    }

    const total = layGioHang().reduce((s, i) => s + i.soLuong, 0);

    badge.style.display = total > 0 ? "inline-block" : "none";
    badge.textContent = total > 99 ? "99+" : total;
}

// ============================================================
// UI
// ============================================================
function hienToast(msg, kind) {
    const toast = document.getElementById("cart-toast");
    const text = document.getElementById("cart-toast-msg");
    if (!toast || !text) return;
    text.textContent = msg;
    const k = kind || (String(msg).indexOf("Vui lòng quét") === 0 ? "warning" : "success");
    toast.classList.remove("cart-toast--success", "cart-toast--warning");
    toast.classList.add(k === "warning" ? "cart-toast--warning" : "cart-toast--success");
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 2500);
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
        ${half ? '<i class="fa-solid fa-star-half-stroke"></i>' : ""}
        ${'<i class="fa-regular fa-star"></i>'.repeat(empty)}
    `;
}

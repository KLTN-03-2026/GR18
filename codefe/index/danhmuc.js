let API_BASE = window.RESTAURANT_API_BASE || "http://192.168.1.27:8080/api";
const API_BASE_CANDIDATES = [
    API_BASE,
    "http://192.168.1.27:8080/api",
    "http://localhost:8080/api",
    "http://127.0.0.1:8080/api"
];

const MENU_IMAGE_FALLBACK =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90">' +
        '<rect fill="#e9ecef" width="120" height="90"/>' +
        '<text x="60" y="48" text-anchor="middle" font-size="12" fill="#6c757d" font-family="system-ui,sans-serif">No image</text>' +
        "</svg>"
    );

let menuItems = [];
let categoryItems = [];
let selectedCategoryKey = "__all";

function normalizeCategoryKey(input) {
    const s = String(input || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    return s || "khac";
}

function getCategoryName(item) {
    if (!item) return "Khác";
    if (typeof item.categoryName === "string" && item.categoryName.trim()) return item.categoryName.trim();
    if (typeof item.category === "string" && item.category.trim()) return item.category.trim();
    if (item.category && typeof item.category.name === "string" && item.category.name.trim()) return item.category.name.trim();
    return "Khác";
}

async function fetchWithFallback(path) {
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

function mapCategories(items) {
    const byKey = new Map();
    (items || []).forEach((item) => {
        const name = getCategoryName(item);
        const key = normalizeCategoryKey(name);
        if (!byKey.has(key)) {
            byKey.set(key, {
                key,
                name,
                imageUrl: item.imageUrl || item.image || MENU_IMAGE_FALLBACK,
                count: 0
            });
        }
        byKey.get(key).count += 1;
    });

    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

function renderCategoryGrid(items) {
    const root = document.getElementById("category-grid");
    if (!root) return;
    if (!items.length) {
        root.innerHTML = '<div class="col-12 text-muted">Chưa có danh mục đang hoạt động.</div>';
        return;
    }

    root.innerHTML = items
        .map((cat) => `
            <div class="col">
                <div class="cat-item p-3 border rounded shadow-sm ${selectedCategoryKey === cat.key ? "active" : ""}"
                     onclick="selectCategory('${cat.key}')">
                    <img class="cat-img-box mb-2" src="${cat.imageUrl}" alt="${cat.name}"
                         onerror="if(!this.dataset._fb){this.dataset._fb='1';this.onerror=null;this.src='${MENU_IMAGE_FALLBACK}';}">
                    <p class="small fw-bold mb-1">${cat.name}</p>
                    <p class="small text-muted mb-0">${cat.count} món</p>
                </div>
            </div>
        `)
        .join("");
}

function renderCategoryPreview() {
    const title = document.getElementById("category-preview-title");
    const root = document.getElementById("category-preview-list");
    const viewMoreBtn = document.getElementById("viewMoreBtn");
    if (!title || !root || !viewMoreBtn) return;

    const cat = categoryItems.find((c) => c.key === selectedCategoryKey) || categoryItems[0];
    if (!cat) {
        title.textContent = "MÓN THEO DANH MỤC";
        root.innerHTML = '<div class="col-12 text-muted text-center">Không có dữ liệu món ăn.</div>';
        return;
    }

    const previewItems = menuItems
        .filter((item) => normalizeCategoryKey(getCategoryName(item)) === cat.key)
        .slice(0, 4);

    title.textContent = cat.name.toUpperCase();
    viewMoreBtn.onclick = () => {
        window.location.href = `menu.html?category=${encodeURIComponent(cat.name)}`;
    };

    if (!previewItems.length) {
        root.innerHTML = '<div class="col-12 text-muted text-center">Danh mục này chưa có món.</div>';
        return;
    }

    root.innerHTML = previewItems
        .map((item) => `
            <div class="col-md-6">
                <div class="dish-card-long d-flex gap-3 p-3 border rounded shadow-sm bg-white h-100">
                    <img src="${item.imageUrl || item.image || MENU_IMAGE_FALLBACK}"
                         style="width:96px;height:96px;object-fit:cover;border-radius:8px"
                         alt="${item.name || "Món ăn"}"
                         onerror="if(!this.dataset._fb){this.dataset._fb='1';this.onerror=null;this.src='${MENU_IMAGE_FALLBACK}';}">
                    <div class="d-flex flex-column justify-content-between w-100">
                        <div>
                            <h5 class="fw-bold mb-1">${item.name || "Món ăn"}</h5>
                            <p class="small text-muted mb-2">${item.description || "Món ăn theo danh mục đã chọn."}</p>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold text-orange">${formatVnd(item.price || 0)}</span>
                            <button class="btn btn-outline-secondary btn-sm px-3 rounded-1"
                                    onclick="goToMenuDetail(${item.id})">Chi tiết</button>
                        </div>
                    </div>
                </div>
            </div>
        `)
        .join("");
}

function selectCategory(categoryKey) {
    selectedCategoryKey = categoryKey || "__all";
    renderCategoryGrid(categoryItems);
    renderCategoryPreview();
}

function goToMenuDetail(id) {
    window.location.href = `menu-detail.html?id=${encodeURIComponent(id)}`;
}

function formatVnd(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function filterCategoryByKeyword() {
    const keyword = (document.getElementById("categorySearchInput")?.value || "").trim().toLowerCase();
    if (!keyword) {
        renderCategoryGrid(categoryItems);
        return;
    }
    const filtered = categoryItems.filter((cat) => cat.name.toLowerCase().includes(keyword));
    renderCategoryGrid(filtered);
}

async function initCategoryPage() {
    const searchInput = document.getElementById("categorySearchInput");
    const searchBtn = document.getElementById("categorySearchBtn");
    searchInput?.addEventListener("input", filterCategoryByKeyword);
    searchBtn?.addEventListener("click", filterCategoryByKeyword);

    try {
        const json = await fetchWithFallback("/menu");
        menuItems = json?.data || [];
        categoryItems = mapCategories(menuItems);
        selectedCategoryKey = categoryItems[0]?.key || "__all";
        renderCategoryGrid(categoryItems);
        renderCategoryPreview();
    } catch (err) {
        console.error("Không tải được danh mục:", err);
        const root = document.getElementById("category-grid");
        if (root) root.innerHTML = '<div class="col-12 text-danger">Không tải được danh mục từ backend.</div>';
    }
}

window.selectCategory = selectCategory;
window.goToMenuDetail = goToMenuDetail;
window.addEventListener("DOMContentLoaded", initCategoryPage);

const RESTAURANT_ROOT = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");
const MENU_ADMIN_BASE = `${RESTAURANT_ROOT}/admin`;
const MENU_IMAGE_FALLBACK =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180">' +
            '<rect width="300" height="180" fill="#f1f3f5"/>' +
            '<text x="150" y="94" text-anchor="middle" font-size="16" fill="#6c757d" font-family="Arial,sans-serif">No image</text>' +
        "</svg>"
    );

function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

let menuModalInstance = null;
let categoryModalInstance = null;
let uploadedPreviewObjectUrl = null;
const BACKEND_ORIGIN = RESTAURANT_ROOT.replace(/\/api\/?$/, "");
let currentCategoryId = null;
let currentViewMode = "grid";
let categoryCache = [];
/** null = thêm món; số = đang sửa */
let editingMenuItemId = null;
/** Món đang hiển thị theo API (đã lọc danh mục); ô tìm kiếm lọc cục bộ trên mảng này */
let menuItemsSnapshot = [];

function menuSearchQueryNormalized() {
    return normalizeCategoryKey(document.getElementById("menuSearchInput")?.value || "");
}

function filterItemsBySearchQuery(items, qNormalized) {
    if (!qNormalized) return items || [];
    return (items || []).filter((item) => {
        const name = normalizeCategoryKey(item?.name);
        const desc = normalizeCategoryKey(item?.description);
        return name.includes(qNormalized) || desc.includes(qNormalized);
    });
}

function refreshMenuGrid() {
    renderMenu(filterItemsBySearchQuery(menuItemsSnapshot, menuSearchQueryNormalized()));
}

function normalizeCategoryKey(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function isCorruptedCategoryName(name) {
    const value = String(name || "");
    // Loai ten danh muc loi encoding / ky tu dieu khien.
    return /�/.test(value) || /[\u0000-\u001F]/.test(value);
}

function uniqueCategories(categories) {
    const seen = new Set();
    const result = [];
    (categories || []).forEach((c) => {
        if (isCorruptedCategoryName(c?.name)) return;
        const key = normalizeCategoryKey(c?.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(c);
    });
    return result;
}

// ===== API =====
async function api(url, options = {}) {
    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken()
        },
        ...options
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json?.message || "Yeu cau that bai");
    }
    if (json && json.success === false) {
        throw new Error(json?.message || "Yeu cau that bai");
    }
    return json;
}

/** Hiển thị an toàn trong innerHTML template */
function escapeHtml(text) {
    if (text == null) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

// ===== LOAD MENU =====
async function loadMenu() {
    const data = await api(`${MENU_ADMIN_BASE}/menu-items`);
    menuItemsSnapshot = locMonConHoatDong(data.data || []);
    refreshMenuGrid();
}

function locMonConHoatDong(items) {
    return (items || []).filter((item) => item?.isActive !== false);
}

// ===== RENDER MENU =====
function resolveImageUrl(rawUrl) {
    const value = (rawUrl || "").trim();
    if (!value || value.toLowerCase() === "null" || value.toLowerCase() === "undefined") {
        return MENU_IMAGE_FALLBACK;
    }
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image")) {
        return value;
    }
    if (value.startsWith("/")) {
        return `${BACKEND_ORIGIN}${value}`;
    }
    return `${BACKEND_ORIGIN}/${value}`;
}

// ===== RENDER MENU =====
function renderMenu(items) {
    const container = document.getElementById("menuContainer");

    if (!container) {
    console.error("Không tìm thấy #menuContainer");
    return;
}

    container.innerHTML = "";
    container.classList.toggle("menu-list-mode", currentViewMode === "list");

    const list = items || [];
    if (list.length === 0) {
        const q = menuSearchQueryNormalized();
        const msg = q
            ? "Không có món nào khớp từ khóa. Thử từ khóa khác hoặc xóa ô tìm kiếm."
            : "Chưa có món trong danh mục này.";
        container.innerHTML = `
        <div class="col-12">
            <div class="text-secondary py-5 text-center">${msg}</div>
        </div>`;
        return;
    }

    list.forEach(item => {
        const imageUrl = resolveImageUrl(item.imageUrl);
        const description = (item.description != null ? String(item.description) : "").trim();
        const descBlock = description
            ? `<p class="menu-item-description small text-secondary mb-2">${escapeHtml(description)}</p>`
            : `<p class="menu-item-description small text-secondary fst-italic mb-2 opacity-50">Chưa có mô tả</p>`;
        container.innerHTML += `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="menu-grid-card">
                <div class="img-wrapper">
                    <img src="${imageUrl}" onerror="this.onerror=null;this.src='${MENU_IMAGE_FALLBACK}'">
                </div>
                <div class="p-4">
                    <h5>${escapeHtml(item.name)}</h5>
                    <span class="d-block fw-semibold mb-2 text-primary">${Number(item.price || 0).toLocaleString("vi-VN")} VND</span>
                    ${descBlock}
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="editItem(${item.id})">
                            <i class="fa-solid fa-pen-to-square me-1"></i>Sửa
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteItem(${item.id})">
                            <i class="fa-solid fa-trash me-1"></i>Xóa
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

// ===== DELETE =====
async function deleteItem(id) {
    if (!confirm("Xóa món này?")) return;
    try {
        await api(`${MENU_ADMIN_BASE}/menu-items/${id}`, {
            method: "DELETE"
        });
        loadMenu();
        showActionToast("Xoa mon thanh cong", "success");
    } catch (err) {
        showActionToast(err.message || "Xoa mon that bai", "error");
    }
}

// ===== TOGGLE =====
async function toggleAvailable(id, isAvailable) {
    await api(`${MENU_ADMIN_BASE}/menu-items/${id}/availability?isAvailable=${!isAvailable}`, {
        method: "PATCH"
    });

    loadMenu();
}

// ===== Thêm / Sửa món (cùng modal) =====
async function submitMenuModal() {
    const name = document.getElementById("name")?.value.trim() || "";
    const priceRaw = document.getElementById("price")?.value;
    const categoryIdVal = document.getElementById("category")?.value;
    const description = document.getElementById("desc")?.value.trim() || "";
    const imageUrl = document.getElementById("img")?.value.trim() || "";

    const price = Number(priceRaw);
    if (!name) {
        showActionToast("Vui lòng nhập tên món.", "error");
        return;
    }
    if (!Number.isFinite(price) || price < 0) {
        showActionToast("Giá không hợp lệ.", "error");
        return;
    }
    if (!categoryIdVal) {
        showActionToast("Vui lòng chọn danh mục.", "error");
        return;
    }

    const body = {
        name,
        price,
        categoryId: Number(categoryIdVal),
        description,
        imageUrl
    };

    try {
        if (editingMenuItemId != null) {
            await api(`${MENU_ADMIN_BASE}/menu-items/${editingMenuItemId}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });
            showActionToast("Đã cập nhật món.", "success");
        } else {
            await api(`${MENU_ADMIN_BASE}/menu-items`, {
                method: "POST",
                body: JSON.stringify(body)
            });
            showActionToast("Đã thêm món.", "success");
        }
        menuModalInstance?.hide();
        loadMenu();
    } catch (err) {
        console.error("Lưu món:", err);
        showActionToast(err.message || "Không lưu được món.", "error");
    }
}

// ===== CATEGORY =====
async function loadCategories() {
    const data = await api(`${MENU_ADMIN_BASE}/categories`);
    categoryCache = uniqueCategories(data.data || []);
    renderCategories(categoryCache);
    fillCategorySelect(categoryCache);
    fillCategoryEditSelect(categoryCache);
}

function renderCategories(categories) {
    const nav = document.getElementById("categoryNav");

    if (!nav) return;

    nav.innerHTML = `
        <button class="nav-link" data-category-id="all" onclick="chonDanhMuc('all')">Tất cả</button>
    `;

    categories.forEach(c => {
        nav.innerHTML += `
            <button class="nav-link" data-category-id="${c.id}" onclick="chonDanhMuc(${c.id})">
                ${c.name}
            </button>
        `;
    });

    capNhatTrangThaiNutDanhMuc();
}

// ===== SELECT CATEGORY =====
function fillCategorySelect(categories) {
    const select = document.getElementById("category");

    if (!select) {
        console.warn("Select category chưa tồn tại");
        return;
    }

    select.innerHTML = "";

    categories.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

function fillCategoryEditSelect(categories) {
    const select = document.getElementById("categoryEditSelect");
    if (!select) return;
    select.innerHTML = "";
    (categories || []).forEach((c) => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    bindCategoryEditForm();
}

// ===== FILTER =====
async function filterByCategory(categoryId) {
    const data = await api(`${MENU_ADMIN_BASE}/menu-items?categoryId=${categoryId}`);
    menuItemsSnapshot = locMonConHoatDong(data.data || []);
    refreshMenuGrid();
}

function chonDanhMuc(categoryId) {
    if (categoryId === "all") {
        currentCategoryId = null;
        capNhatTrangThaiNutDanhMuc();
        loadMenu();
        return;
    }
    currentCategoryId = Number(categoryId);
    capNhatTrangThaiNutDanhMuc();
    filterByCategory(currentCategoryId);
}

function capNhatTrangThaiNutDanhMuc() {
    const nav = document.getElementById("categoryNav");
    if (!nav) return;
    const buttons = nav.querySelectorAll(".nav-link");
    buttons.forEach((btn) => {
        const id = btn.getAttribute("data-category-id");
        const active = currentCategoryId == null ? id === "all" : String(currentCategoryId) === id;
        btn.classList.toggle("active", active);
    });
}

/** Trạng thái nút lưới / danh sách ngang */
function syncViewModeToggleStyles() {
    const gridBtn = document.getElementById("view-grid-btn");
    const listBtn = document.getElementById("view-list-btn");
    if (!gridBtn || !listBtn) return;
    const isGrid = currentViewMode === "grid";
    gridBtn.classList.toggle("text-primary", isGrid);
    gridBtn.classList.toggle("opacity-50", !isGrid);
    listBtn.classList.toggle("text-primary", !isGrid);
    listBtn.classList.toggle("opacity-50", isGrid);
}

function changeViewMode(mode) {
    currentViewMode = mode === "list" ? "list" : "grid";
    syncViewModeToggleStyles();
    refreshMenuGrid();
}

function bindMenuSearchInput() {
    const el = document.getElementById("menuSearchInput");
    if (!el) return;
    el.addEventListener("input", () => {
        clearTimeout(bindMenuSearchInput._timer);
        bindMenuSearchInput._timer = setTimeout(() => refreshMenuGrid(), 180);
    });
}

function openCategoryModal() {
    if (!categoryModalInstance) {
        categoryModalInstance = new bootstrap.Modal(document.getElementById("categoryModal"));
    }
    fillCategoryEditSelect(categoryCache);
    categoryModalInstance.show();
}

function bindCategoryEditForm() {
    const select = document.getElementById("categoryEditSelect");
    if (!select) return;
    const selectedId = Number(select.value);
    const selected = categoryCache.find((c) => c.id === selectedId) || categoryCache[0];
    if (!selected) return;

    if (select.value !== String(selected.id)) {
        select.value = String(selected.id);
    }
    document.getElementById("categoryEditName").value = selected.name || "";
    document.getElementById("categoryEditDescription").value = selected.description || "";
    document.getElementById("categoryEditImageUrl").value = selected.imageUrl || "";
    document.getElementById("categoryEditSortOrder").value = selected.sortOrder ?? 0;
}

async function saveSelectedCategory() {
    const select = document.getElementById("categoryEditSelect");
    const id = Number(select?.value);
    if (!id) return;

    const body = {
        name: document.getElementById("categoryEditName").value.trim(),
        description: document.getElementById("categoryEditDescription").value.trim(),
        imageUrl: document.getElementById("categoryEditImageUrl").value.trim(),
        sortOrder: Number(document.getElementById("categoryEditSortOrder").value || 0)
    };

    try {
        await api(`${MENU_ADMIN_BASE}/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });
        showActionToast("Cap nhat danh muc thanh cong", "success");
        await loadCategories();
        if (currentCategoryId == null) {
            await loadMenu();
        } else {
            await filterByCategory(currentCategoryId);
        }
    } catch (err) {
        showActionToast(err.message || "Cap nhat danh muc that bai", "error");
    }
}

async function deleteSelectedCategory() {
    const select = document.getElementById("categoryEditSelect");
    const id = Number(select?.value);
    if (!id) return;
    if (!confirm("Ban co chac muon xoa danh muc nay?")) return;
    try {
        await api(`${MENU_ADMIN_BASE}/categories/${id}`, { method: "DELETE" });
        showActionToast("Xoa danh muc thanh cong", "success");
        currentCategoryId = null;
        await loadCategories();
        await loadMenu();
    } catch (err) {
        showActionToast(err.message || "Xoa danh muc that bai", "error");
    }
}

// ===== Sửa món (mở modal giống thêm) =====
async function editItem(id) {
    try {
        if (!document.getElementById("category")?.options?.length) {
            await loadCategories();
        }

        let item = menuItemsSnapshot.find((x) => x.id === id);
        if (!item) {
            const data = await api(`${MENU_ADMIN_BASE}/menu-items`);
            item = (data.data || []).find((x) => x.id === id);
        }
        if (!item) {
            showActionToast("Không tìm thấy món.", "error");
            return;
        }

        if (!menuModalInstance) {
            menuModalInstance = new bootstrap.Modal(document.getElementById("menuModal"));
        }

        editingMenuItemId = id;
        const titleEl = document.getElementById("menuModalTitle");
        if (titleEl) titleEl.textContent = "Sửa món";

        resetCreateForm();

        document.getElementById("name").value = item.name || "";
        document.getElementById("price").value =
            item.price !== undefined && item.price !== null ? String(item.price) : "";
        document.getElementById("desc").value = item.description || "";
        document.getElementById("img").value = item.imageUrl || "";

        const catSel = document.getElementById("category");
        if (catSel && item.categoryId != null) {
            catSel.value = String(item.categoryId);
        } else if (catSel && item.categoryName) {
            const want = String(item.categoryName).trim();
            const opt = Array.from(catSel.options).find((o) => o.textContent.trim() === want);
            if (opt) catSel.value = opt.value;
        }

        const preview = document.getElementById("imgPreview");
        const uploadNote = document.getElementById("imgUploadNote");
        const rawImg = (item.imageUrl || "").trim();
        if (rawImg && preview) {
            preview.src = resolveImageUrl(item.imageUrl);
            preview.classList.remove("d-none");
            if (uploadNote) uploadNote.classList.add("d-none");
        }

        menuModalInstance.show();
    } catch (err) {
        showActionToast(err.message || "Không mở được form sửa.", "error");
    }
}

function showActionToast(message, type = "success") {
    let toast = document.getElementById("admin-action-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "admin-action-toast";
        toast.style.position = "fixed";
        toast.style.right = "20px";
        toast.style.bottom = "20px";
        toast.style.zIndex = "9999";
        toast.style.color = "#fff";
        toast.style.padding = "12px 16px";
        toast.style.borderRadius = "10px";
        toast.style.boxShadow = "0 8px 22px rgba(0,0,0,.22)";
        toast.style.fontWeight = "600";
        toast.style.display = "none";
        document.body.appendChild(toast);
    }

    toast.style.background = type === "error" ? "#dc3545" : "#198754";
    toast.textContent = message;
    toast.style.display = "block";

    clearTimeout(showActionToast._timer);
    showActionToast._timer = setTimeout(() => {
        toast.style.display = "none";
    }, 2200);
}

// ===== MODAL =====
function openCreateModal() {
    if (!menuModalInstance) {
        menuModalInstance = new bootstrap.Modal(document.getElementById("menuModal"));
    }
    editingMenuItemId = null;
    const titleEl = document.getElementById("menuModalTitle");
    if (titleEl) titleEl.textContent = "Thêm món";
    resetCreateForm();
    menuModalInstance.show();
}

function resetCreateForm() {
    const nameInput = document.getElementById("name");
    const priceInput = document.getElementById("price");
    const imgInput = document.getElementById("img");
    const descInput = document.getElementById("desc");
    const categorySelect = document.getElementById("category");
    const fileInput = document.getElementById("imgFile");
    const preview = document.getElementById("imgPreview");
    const uploadNote = document.getElementById("imgUploadNote");

    if (nameInput) nameInput.value = "";
    if (priceInput) priceInput.value = "";
    if (imgInput) imgInput.value = "";
    if (descInput) descInput.value = "";
    if (fileInput) fileInput.value = "";
    if (preview) {
        if (uploadedPreviewObjectUrl) {
            URL.revokeObjectURL(uploadedPreviewObjectUrl);
            uploadedPreviewObjectUrl = null;
        }
        preview.src = "";
        preview.classList.add("d-none");
    }
    if (uploadNote) {
        uploadNote.textContent = "Chua co anh duoc chon.";
        uploadNote.classList.remove("d-none");
    }
    if (categorySelect && categorySelect.options.length > 0) {
        categorySelect.selectedIndex = 0;
    }
}

function bindUploadImageInput() {
    const fileInput = document.getElementById("imgFile");
    const imgInput = document.getElementById("img");
    const preview = document.getElementById("imgPreview");
    const uploadNote = document.getElementById("imgUploadNote");

    if (!fileInput || !imgInput || !preview) return;

    fileInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            if (uploadedPreviewObjectUrl) {
                URL.revokeObjectURL(uploadedPreviewObjectUrl);
                uploadedPreviewObjectUrl = null;
            }
            preview.src = "";
            preview.classList.add("d-none");
            if (uploadNote) {
                uploadNote.textContent = "Chua co anh duoc chon.";
                uploadNote.classList.remove("d-none");
            }
            return;
        }
        if (uploadedPreviewObjectUrl) {
            URL.revokeObjectURL(uploadedPreviewObjectUrl);
        }
        uploadedPreviewObjectUrl = URL.createObjectURL(file);
        preview.src = uploadedPreviewObjectUrl;
        preview.classList.remove("d-none");
        if (uploadNote) {
            uploadNote.classList.remove("d-none");
            uploadNote.textContent = `Da chon file: ${file.name}. Anh se duoc luu khi bam Luu.`;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = typeof reader.result === "string" ? reader.result : "";
            imgInput.value = base64;
        };
        reader.readAsDataURL(file);
    });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    const modalEl = document.getElementById("menuModal");
    if (modalEl) {
        menuModalInstance = new bootstrap.Modal(modalEl);
        modalEl.addEventListener("hidden.bs.modal", () => {
            editingMenuItemId = null;
            const titleEl = document.getElementById("menuModalTitle");
            if (titleEl) titleEl.textContent = "Thêm món";
            resetCreateForm();
        });
    }
    const categoryModalEl = document.getElementById("categoryModal");
    if (categoryModalEl) {
        categoryModalInstance = new bootstrap.Modal(categoryModalEl);
    }
    document.getElementById("categoryEditSelect")?.addEventListener("change", bindCategoryEditForm);
    bindUploadImageInput();
    bindMenuSearchInput();
    syncViewModeToggleStyles();
    loadMenu();
    loadCategories();
});
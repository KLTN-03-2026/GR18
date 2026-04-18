const API_BASE = "http://localhost:8080/api/admin";
const MENU_IMAGE_FALLBACK =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180">' +
            '<rect width="300" height="180" fill="#f1f3f5"/>' +
            '<text x="150" y="94" text-anchor="middle" font-size="16" fill="#6c757d" font-family="Arial,sans-serif">No image</text>' +
        "</svg>"
    );

function getToken() {
    return localStorage.getItem("accessToken");
}

let menuModalInstance = null;
let categoryModalInstance = null;
let uploadedPreviewObjectUrl = null;
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/admin\/?$/, "");
let currentCategoryId = null;
let currentViewMode = "grid";
let categoryCache = [];

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

// ===== LOAD MENU =====
async function loadMenu() {
    const data = await api(`${API_BASE}/menu-items`);
    const items = locMonConHoatDong(data.data || []);
    renderMenu(items);
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

    items.forEach(item => {
        const imageUrl = resolveImageUrl(item.imageUrl);
        container.innerHTML += `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="menu-grid-card">
                <div class="img-wrapper">
                    <img src="${imageUrl}" onerror="this.onerror=null;this.src='${MENU_IMAGE_FALLBACK}'">
                </div>
                <div class="p-4">
                    <h5>${item.name}</h5>
                    <span class="d-block mb-2">${Number(item.price || 0).toLocaleString("vi-VN")} VND</span>
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
        await api(`${API_BASE}/menu-items/${id}`, {
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
    await api(`${API_BASE}/menu-items/${id}/availability?isAvailable=${!isAvailable}`, {
        method: "PATCH"
    });

    loadMenu();
}

// ===== CREATE =====
async function createItem() {
    const imageUrl = document.getElementById("img").value.trim();

    const body = {
        name: document.getElementById("name").value.trim(),
        price: document.getElementById("price").value,
        categoryId: document.getElementById("category").value,
        description: document.getElementById("desc").value.trim(),
        imageUrl
    };

    try {
        await api(`${API_BASE}/menu-items`, {
            method: "POST",
            body: JSON.stringify(body)
        });
        loadMenu();
        menuModalInstance?.hide();
        showActionToast("Them mon thanh cong", "success");
    } catch (err) {
        console.error("Tao mon that bai:", err);
        showActionToast(err.message || "Khong them duoc mon. Vui long thu lai.", "error");
    }
}

// ===== CATEGORY =====
async function loadCategories() {
    const data = await api(`${API_BASE}/categories`);
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
    const data = await api(`${API_BASE}/menu-items?categoryId=${categoryId}`);
    renderMenu(locMonConHoatDong(data.data || []));
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

function changeViewMode(mode) {
    currentViewMode = mode === "list" ? "list" : "grid";
    document.getElementById("view-grid-btn")?.classList.toggle("text-primary", currentViewMode === "grid");
    document.getElementById("view-list-btn")?.classList.toggle("text-primary", currentViewMode === "list");
    if (currentCategoryId == null) {
        loadMenu();
    } else {
        filterByCategory(currentCategoryId);
    }
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
        await api(`${API_BASE}/categories/${id}`, {
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
        await api(`${API_BASE}/categories/${id}`, { method: "DELETE" });
        showActionToast("Xoa danh muc thanh cong", "success");
        currentCategoryId = null;
        await loadCategories();
        await loadMenu();
    } catch (err) {
        showActionToast(err.message || "Xoa danh muc that bai", "error");
    }
}

// ===== EDIT (simple) =====
async function editItem(id) {
    try {
        const data = await api(`${API_BASE}/menu-items`);
        const item = (data.data || []).find((x) => x.id === id);
        if (!item) {
            alert("Khong tim thay mon can sua.");
            return;
        }

        const name = prompt("Ten moi:", item.name || "");
        if (name == null) return;
        const priceRaw = prompt("Gia moi:", String(item.price || 0));
        if (priceRaw == null) return;
        const description = prompt("Mo ta moi:", item.description || "");
        if (description == null) return;
        const imageUrl = prompt("Link anh moi:", item.imageUrl || "");
        if (imageUrl == null) return;

        const price = Number(priceRaw);
        if (!name.trim() || !Number.isFinite(price) || price < 0) {
            alert("Ten hoac gia khong hop le.");
            return;
        }

        await api(`${API_BASE}/menu-items/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                name: name.trim(),
                price,
                description: description.trim(),
                imageUrl: imageUrl.trim()
            })
        });

        loadMenu();
        showActionToast("Cap nhat mon thanh cong", "success");
    } catch (err) {
        showActionToast(err.message || "Sua mon that bai", "error");
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
            if (uploadNote) uploadNote.textContent = "Chua co anh duoc chon.";
            return;
        }
        if (uploadedPreviewObjectUrl) {
            URL.revokeObjectURL(uploadedPreviewObjectUrl);
        }
        uploadedPreviewObjectUrl = URL.createObjectURL(file);
        preview.src = uploadedPreviewObjectUrl;
        preview.classList.remove("d-none");
        if (uploadNote) {
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
        modalEl.addEventListener("hidden.bs.modal", resetCreateForm);
    }
    const categoryModalEl = document.getElementById("categoryModal");
    if (categoryModalEl) {
        categoryModalInstance = new bootstrap.Modal(categoryModalEl);
    }
    document.getElementById("categoryEditSelect")?.addEventListener("change", bindCategoryEditForm);
    bindUploadImageInput();
    loadMenu();
    loadCategories();
});
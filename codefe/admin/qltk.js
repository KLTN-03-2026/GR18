/**
 * Quản lý tài khoản (ADMIN) — CUSTOMER / STAFF / ADMIN
 */
const QLTK_API = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");

let currentRoleTab = "ALL";

function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
}

function getCurrentUserId() {
    try {
        const u = JSON.parse(localStorage.getItem("userInfo") || "{}");
        const id = Number(u.userId);
        return Number.isFinite(id) ? id : null;
    } catch {
        return null;
    }
}

function isSelf(userId) {
    const me = getCurrentUserId();
    return me != null && userId === me;
}

function ensureAdminRoute() {
    try {
        const u = JSON.parse(localStorage.getItem("userInfo") || "{}");
        if (u.role !== "ADMIN") {
            window.location.href = "tongquan.html";
            return false;
        }
    } catch {
        window.location.href = "tongquan.html";
        return false;
    }
    return true;
}

function authHeaders() {
    const t = getAdminToken();
    const h = { "Content-Type": "application/json" };
    if (t) h.Authorization = "Bearer " + t;
    return h;
}

let members = [];
let filtered = [];
let createModal;
let editModal;
let resetModal;

function showToast(message, isError) {
    const body = document.getElementById("qltk-toast-body");
    const el = document.getElementById("qltk-toast");
    if (!body || !el) {
        alert(message);
        return;
    }
    el.classList.remove("text-bg-success", "text-bg-danger");
    el.classList.add(isError ? "text-bg-danger" : "text-bg-success");
    body.textContent = message;
    const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 3600 });
    t.show();
}

function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
}

function initials(name) {
    if (!name || !String(name).trim()) return "?";
    const p = String(name).trim().split(/\s+/);
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function formatJoined(iso) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return "—";
    }
}

function roleLabel(role) {
    const m = { CUSTOMER: "Khách hàng", STAFF: "Nhân viên", ADMIN: "Quản trị" };
    return m[role] || role || "—";
}

function roleBadgeClass(role) {
    if (role === "ADMIN") return "badge-role bg-secondary-container-soft text-success";
    if (role === "STAFF") return "badge-role bg-primary-container-soft text-primary";
    return "badge-role bg-surface-container-highest text-secondary";
}

async function apiJson(path, options = {}) {
    const res = await fetch(QLTK_API + path, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json.message || json.error || "Lỗi " + res.status;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    if (json.success === false) {
        const msg = json.message || json.error || "Yêu cầu thất bại";
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return json;
}

async function loadMembers() {
    const tbody = document.getElementById("member-tbody");
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-secondary">Đang tải…</td></tr>';
    }
    try {
        let path =
            currentRoleTab === "ALL" ? "/admin/users" : "/admin/users/role/" + encodeURIComponent(currentRoleTab);
        const json = await apiJson(path, { method: "GET" });
        members = Array.isArray(json.data) ? json.data : [];
        applyFilter();
        updateStats();
    } catch (e) {
        console.error(e);
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="text-center py-4 text-danger">Không tải được danh sách (cần quyền Admin và backend).</td></tr>';
        }
        showToast(e.message || "Lỗi tải dữ liệu", true);
    }
}

function applyFilter() {
    const q = (document.getElementById("member-search")?.value || "").trim().toLowerCase();
    if (!q) {
        filtered = members.slice();
    } else {
        filtered = members.filter((u) => {
            const name = (u.fullName || "").toLowerCase();
            const em = (u.email || "").toLowerCase();
            const ph = (u.phone || "").toLowerCase();
            const idStr = String(u.id || "").toLowerCase();
            return name.includes(q) || em.includes(q) || ph.includes(q) || idStr.includes(q);
        });
    }
    renderTable();
}

function updateStats() {
    const total = members.length;
    const active = members.filter((u) => u.isActive !== false).length;
    const locked = total - active;
    const elT = document.getElementById("stat-total");
    const elA = document.getElementById("stat-active");
    const elL = document.getElementById("stat-locked");
    if (elT) elT.textContent = String(total);
    if (elA) elA.textContent = String(active);
    if (elL) elL.textContent = String(locked);
}

function renderTable() {
    const tbody = document.getElementById("member-tbody");
    const footer = document.getElementById("member-footer");
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" class="text-center py-5 text-secondary">Không có tài khoản nào khớp bộ lọc.</td></tr>';
        if (footer) footer.textContent = "Hiển thị 0 tài khoản";
        return;
    }

    tbody.innerHTML = filtered
        .map((u) => {
            const active = u.isActive !== false;
            const self = isSelf(Number(u.id));
            const toggleBtn =
                self
                    ? `<span class="smaller text-secondary" title="Không thể khóa chính bạn">—</span>`
                    : `<button type="button" class="btn btn-icon-sm ${active ? "text-warning" : "text-success"} btn-toggle" data-id="${u.id}" data-active="${active}" title="${active ? "Khóa" : "Mở khóa"}">
                        <span class="material-symbols-outlined fs-5">${active ? "lock" : "lock_open"}</span>
                    </button>`;
            const roleSel = escapeHtml(roleLabel(u.role));
            const badgeClass = roleBadgeClass(u.role);
            return `
            <tr class="user-row ${self ? "row-alt" : ""}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="avatar-init bg-primary-container text-primary fw-bold">${escapeHtml(initials(u.fullName))}</div>
                        <div>
                            <p class="mb-0 fw-bold">${escapeHtml(u.fullName || "")}${self ? ' <span class="badge bg-primary-subtle text-primary smaller">Bạn</span>' : ""}</p>
                            <p class="smaller text-secondary mb-0">Tham gia ${formatJoined(u.createdAt)} · ID ${u.id}</p>
                        </div>
                    </div>
                </td>
                <td><span class="small">${escapeHtml(u.phone || "—")}</span></td>
                <td><span class="small text-light-emphasis">${escapeHtml(u.email || "—")}</span></td>
                <td><span class="${badgeClass}">${roleSel}</span></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="dot-sm ${active ? "bg-success" : "bg-secondary"}"></span>
                        <span class="small fw-medium ${active ? "text-success" : "text-secondary"}">${active ? "Hoạt động" : "Đã khóa"}</span>
                    </div>
                </td>
                <td class="text-end pe-4">
                    <div class="action-btns d-flex justify-content-end flex-wrap gap-1">
                        <button type="button" class="btn btn-icon-sm btn-edit" data-id="${u.id}" title="Sửa"><span class="material-symbols-outlined fs-5">edit_note</span></button>
                        <button type="button" class="btn btn-icon-sm btn-reset-pw" data-id="${u.id}" title="Đặt lại mật khẩu"><span class="material-symbols-outlined fs-5">key</span></button>
                        ${toggleBtn}
                    </div>
                </td>
            </tr>`;
        })
        .join("");

    if (footer) {
        footer.textContent = `Hiển thị ${filtered.length} trên ${members.length} tài khoản`;
    }

    tbody.querySelectorAll(".btn-edit").forEach((btn) => {
        btn.addEventListener("click", () => openEdit(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll(".btn-reset-pw").forEach((btn) => {
        btn.addEventListener("click", () => openResetPw(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll(".btn-toggle").forEach((btn) => {
        btn.addEventListener("click", () => toggleActive(Number(btn.dataset.id), btn.dataset.active === "true"));
    });
}

function setEditRoleUi(self) {
    const sel = document.getElementById("edit-role");
    const hint = document.getElementById("edit-role-hint-self");
    if (!sel) return;
    if (self) {
        sel.disabled = true;
        if (hint) hint.classList.remove("d-none");
    } else {
        sel.disabled = false;
        if (hint) hint.classList.add("d-none");
    }
}

function openEdit(id) {
    const u = members.find((x) => x.id === id);
    if (!u) return;
    const self = isSelf(id);
    document.getElementById("edit-id").value = String(id);
    document.getElementById("edit-fullname").value = u.fullName || "";
    document.getElementById("edit-email").value = u.email || "";
    document.getElementById("edit-phone").value = u.phone || "";
    document.getElementById("edit-role").value = u.role || "CUSTOMER";
    setEditRoleUi(self);
    editModal.show();
}

function openResetPw(id) {
    const u = members.find((x) => x.id === id);
    if (!u) return;
    document.getElementById("reset-id").value = String(id);
    document.getElementById("reset-password").value = "";
    document.getElementById("reset-label").textContent = `${u.fullName || "ID " + id}`;
    resetModal.show();
}

async function saveEdit() {
    const id = Number(document.getElementById("edit-id").value);
    const uRow = members.find((x) => x.id === id);
    const fullName = document.getElementById("edit-fullname").value.trim();
    const email = document.getElementById("edit-email").value.trim();
    const phone = document.getElementById("edit-phone").value.trim();
    const roleEl = document.getElementById("edit-role");
    const self = isSelf(id);
    const role = self ? uRow?.role || "ADMIN" : roleEl.value;

    if (!fullName) {
        showToast("Nhập họ tên.", true);
        return;
    }
    if (phone && !/^0\d{9}$/.test(phone)) {
        showToast("Số điện thoại phải 10 số bắt đầu bằng 0.", true);
        return;
    }

    const body = {
        fullName,
        email: email ? email : null,
        phone: phone ? phone : null,
        role: role
    };
    try {
        await apiJson("/admin/users/" + id, {
            method: "PUT",
            body: JSON.stringify(body)
        });
        editModal.hide();
        showToast("Đã cập nhật tài khoản.");
        await loadMembers();
        if (self) {
            const ui = JSON.parse(localStorage.getItem("userInfo") || "{}");
            ui.fullName = fullName;
            ui.email = email || ui.email;
            ui.phone = phone || ui.phone;
            localStorage.setItem("userInfo", JSON.stringify(ui));
        }
    } catch (e) {
        showToast(e.message || "Cập nhật thất bại", true);
    }
}

function validateStaffAdminContact(email, phone, role) {
    if (role !== "STAFF" && role !== "ADMIN") return null;
    if (!email.trim() && !phone.trim()) {
        return "Nhân viên / Admin cần ít nhất email hoặc số điện thoại để đăng nhập.";
    }
    return null;
}

async function saveCreate() {
    const fullName = document.getElementById("create-fullname").value.trim();
    const email = document.getElementById("create-email").value.trim();
    const phone = document.getElementById("create-phone").value.trim();
    const password = document.getElementById("create-password").value;
    const role = document.getElementById("create-role").value;

    const contactErr = validateStaffAdminContact(email, phone, role);
    if (contactErr) {
        showToast(contactErr, true);
        return;
    }
    if (!fullName || !password || password.length < 6) {
        showToast("Họ tên và mật khẩu (≥6 ký tự) là bắt buộc.", true);
        return;
    }
    if (phone && !/^0\d{9}$/.test(phone)) {
        showToast("Số điện thoại phải 10 số bắt đầu bằng 0.", true);
        return;
    }
    const body = {
        fullName,
        email: email ? email : null,
        phone: phone ? phone : null,
        password,
        role: role
    };
    try {
        await apiJson("/admin/users", {
            method: "POST",
            body: JSON.stringify(body)
        });
        createModal.hide();
        document.getElementById("create-fullname").value = "";
        document.getElementById("create-email").value = "";
        document.getElementById("create-phone").value = "";
        document.getElementById("create-password").value = "";
        document.getElementById("create-role").value = "CUSTOMER";
        showToast("Đã tạo tài khoản.");
        await loadMembers();
    } catch (e) {
        showToast(e.message || "Tạo thất bại", true);
    }
}

async function saveResetPw() {
    const id = Number(document.getElementById("reset-id").value);
    const pw = document.getElementById("reset-password").value;
    if (!pw || pw.length < 6) {
        showToast("Mật khẩu mới tối thiểu 6 ký tự.", true);
        return;
    }
    try {
        const url =
            QLTK_API +
            "/admin/users/" +
            id +
            "/reset-password?newPassword=" +
            encodeURIComponent(pw);
        const res = await fetch(url, {
            method: "PATCH",
            headers: authHeaders()
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(json.message || json.error || "Lỗi " + res.status);
        }
        if (json.success === false) {
            throw new Error(json.message || "Thất bại");
        }
        resetModal.hide();
        showToast("Đã đặt lại mật khẩu.");
    } catch (e) {
        showToast(e.message || "Thất bại", true);
    }
}

async function toggleActive(id, currentlyActive) {
    if (isSelf(id)) {
        showToast("Không thể khóa tài khoản đang đăng nhập.", true);
        return;
    }
    if (!confirm(currentlyActive ? "Khóa tài khoản này? Người dùng sẽ không đăng nhập được." : "Mở lại tài khoản?"))
        return;
    try {
        const url =
            QLTK_API + "/admin/users/" + id + "/toggle-status?isActive=" + (!currentlyActive);
        const res = await fetch(url, {
            method: "PATCH",
            headers: authHeaders()
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(json.message || json.error || "Lỗi " + res.status);
        }
        if (json.success === false) {
            throw new Error(json.message || "Thất bại");
        }
        showToast(currentlyActive ? "Đã khóa tài khoản." : "Đã kích hoạt tài khoản.");
        await loadMembers();
    } catch (e) {
        showToast(e.message || "Thất bại", true);
    }
}

function bindRoleTabs() {
    document.querySelectorAll("[data-role-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.getAttribute("data-role-tab");
            if (!next || next === currentRoleTab) return;
            currentRoleTab = next;
            document.querySelectorAll("[data-role-tab]").forEach((b) => {
                b.classList.toggle("active", b.getAttribute("data-role-tab") === currentRoleTab);
            });
            const searchEl = document.getElementById("member-search");
            if (searchEl) searchEl.value = "";
            loadMembers();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (!getAdminToken()) {
        window.location.href = "../dangnhap.html?next=admin/qltk.html";
        return;
    }
    if (!ensureAdminRoute()) return;

    createModal = new bootstrap.Modal(document.getElementById("modal-create"));
    editModal = new bootstrap.Modal(document.getElementById("modal-edit"));
    resetModal = new bootstrap.Modal(document.getElementById("modal-reset-pw"));

    document.getElementById("btn-open-create")?.addEventListener("click", () => {
        document.getElementById("create-fullname").value = "";
        document.getElementById("create-email").value = "";
        document.getElementById("create-phone").value = "";
        document.getElementById("create-password").value = "";
        document.getElementById("create-role").value = "CUSTOMER";
        createModal.show();
    });
    document.getElementById("btn-create-save")?.addEventListener("click", saveCreate);
    document.getElementById("btn-edit-save")?.addEventListener("click", saveEdit);
    document.getElementById("btn-reset-save")?.addEventListener("click", saveResetPw);
    document.getElementById("member-search")?.addEventListener("input", applyFilter);

    bindRoleTabs();
    loadMembers();
});

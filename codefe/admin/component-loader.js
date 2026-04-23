/** Cùng quy ước với khu vực khách (`RESTAURANT_API_BASE` trong `menu.js` / `giohang.js`). */
const API_BASE = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");

const STAFF_ALLOWED_PAGES = new Set([
    "tongquan.html",
    "datcho.html",
    "donhang.html",
    "qltrangthaiban.html",
    "goinv.html",
    "qlthanhtoan.html",
]);

/** `null` = mọi trang (ADMIN). Set rỗng = không trang nào. */
function getAllowedPagesByRole(role) {
    if (role === "ADMIN") return null;
    if (role === "STAFF") return STAFF_ALLOWED_PAGES;
    return new Set();
}

window.logout = async function () {
    const token = localStorage.getItem("token");

    if (!confirm("Bạn có chắc chắn muốn đăng xuất không?")) return;

    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token
            }
        });
    } catch (e) {
        console.warn("Logout API không phản hồi hoặc lỗi:", e);
    }

    // Xóa toàn bộ dữ liệu phiên làm việc sạch sẽ
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userInfo");
    
    // Điều hướng về trang đăng nhập ở thư mục gốc
    window.location.href = "../dangnhap.html"; 
};

function getCurrentRole() {
    try {
        const raw = localStorage.getItem("userInfo");
        if (!raw) return null;
        const u = JSON.parse(raw);
        return u && u.role ? String(u.role).toUpperCase() : null;
    } catch (e) {
        return null;
    }
}

function enforcePageAccess() {
    const role = getCurrentRole();
    const allowed = getAllowedPagesByRole(role);

    // Admin: không chặn
    if (allowed === null) return;

    const currentPage = window.location.pathname.split("/").pop() || "tongquan.html";

    // Nếu không có quyền thì đá về trang login (kèm next)
    if (!role) {
        window.location.href = "../dangnhap.html?next=admin/" + encodeURIComponent(currentPage);
        return;
    }

    // STAFF chỉ được vào các page trong allowlist
    if (!allowed.has(currentPage)) {
        window.location.href = "tongquan.html";
    }
}

function filterSidebarByRole() {
    const role = getCurrentRole();
    const allowed = getAllowedPagesByRole(role);

    // Admin: full menu
    if (allowed === null) return;

    const navLinks = document.querySelectorAll(".sidebar .nav-link");
    navLinks.forEach((link) => {
        const href = (link.getAttribute("href") || "").split("/").pop();
        if (!href) return;
        if (!allowed.has(href)) {
            link.style.display = "none";
        }
    });
}

function updateHeaderByRole() {
    const role = getCurrentRole();
    const titleEl = document.querySelector(".top-nav h4");
    if (!titleEl) return;
    if (role === "STAFF") {
        titleEl.textContent = "Bảng điều khiển nhân viên";
    } else {
        titleEl.textContent = "Bảng điều khiển quản trị";
    }
}

async function loadComponent(containerId, fileName, callback = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(fileName);
        if (!response.ok) throw new Error(`Không tìm thấy file: ${fileName}`);
        
        const html = await response.text();
        container.innerHTML = html;

        // Chạy callback sau khi HTML đã được chèn vào DOM
        if (callback) callback();
    } catch (err) {
        console.error("Lỗi nạp component:", err);
    }
}

function updateUserInfo() {
    try {
        // Lấy string userInfo từ localStorage
        const userInfoStr = localStorage.getItem('userInfo');
        
        if (userInfoStr) {
            // Chuyển đổi từ string JSON sang Object
            const userInfo = JSON.parse(userInfoStr);
            
            // Tìm phần tử hiển thị tên trong Header
            const nameElement = document.getElementById('header-admin-name');
            
            if (nameElement && userInfo.fullName) {
                nameElement.textContent = userInfo.fullName;
            }
        }
    } catch (error) {
        console.error("Lỗi khi bóc tách thông tin người dùng:", error);
    }
}

function highlightCurrentPage() {
    const currentPage = window.location.pathname.split("/").pop() || 'tongquan.html';
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    navLinks.forEach((link) => {
        const href = (link.getAttribute("href") || "").split("/").pop();
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // Chặn truy cập sai quyền trước khi render
    enforcePageAccess();

    // Nạp Sidebar: Sau khi xong thì highlight menu
    loadComponent('sidebar-container', 'sidebar.html', function () {
        filterSidebarByRole();
        highlightCurrentPage();
    });
    
    // Nạp Header: Sau khi xong thì cập nhật tên Admin từ userInfo
    loadComponent('header-container', 'header.html', function () {
        updateHeaderByRole();
        updateUserInfo();
    });
});
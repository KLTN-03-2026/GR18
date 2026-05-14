/** `window.API_BASE` được set trong `config.js` (auto-switch local/prod). */

const STAFF_ALLOWED_PAGES = new Set([
    "datcho.html",
    "donhang.html",
    "qltrangthaiban.html",
    "goinv.html",
    "qlthanhtoan.html",
]);
const STAFF_DEFAULT_PAGE = "donhang.html";

function getStaffAllowedPagesFromUserInfo() {
    try {
        const raw = localStorage.getItem("userInfo");
        const u = raw ? JSON.parse(raw) : {};
        const rawJson = typeof u.allowedPagesJson === "string" ? u.allowedPagesJson : "";
        if (!rawJson.trim()) return null;
        const arr = JSON.parse(rawJson);
        if (!Array.isArray(arr)) return null;
        const pages = arr
            .map((x) => String(x || "").trim())
            .filter((x) => STAFF_ALLOWED_PAGES.has(x));
        return pages.length ? new Set(pages) : new Set();
    } catch (e) {
        return null;
    }
}

/** `null` = mọi trang (ADMIN). Set rỗng = không trang nào. */
function getAllowedPagesByRole(role) {
    if (role === "ADMIN") return null;
    if (role === "STAFF") {
        const custom = getStaffAllowedPagesFromUserInfo();
        return custom === null ? STAFF_ALLOWED_PAGES : custom;
    }
    return new Set();
}

window.logout = async function () {
    const token = localStorage.getItem("token");

    if (!confirm("Bạn có chắc chắn muốn đăng xuất không?")) return;

    try {
        await fetch(`${window.API_BASE}/auth/logout`, {
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
        window.location.href = role === "STAFF" ? STAFF_DEFAULT_PAGE : "tongquan.html";
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

function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
        if (document.querySelector(`script[data-src-key="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.dataset.srcKey = src;
        s.onload = function () {
            resolve();
        };
        s.onerror = function () {
            reject(new Error("Không tải được: " + src));
        };
        document.head.appendChild(s);
    });
}

async function initHeaderNotificationsChain() {
    try {
        await loadScriptOnce("https://cdn.jsdelivr.net/npm/sockjs-client@1.6.1/dist/sockjs.min.js");
        await loadScriptOnce("https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js");
        await loadScriptOnce("header-notifications.js");
        if (typeof window.initAdminHeaderNotifications === "function") {
            window.initAdminHeaderNotifications();
        }
    } catch (e) {
        console.warn("Thông báo header (SockJS/STOMP):", e);
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
    loadComponent("header-container", "header.html", function () {
        updateHeaderByRole();
        updateUserInfo();
        initHeaderNotificationsChain();
    });
});
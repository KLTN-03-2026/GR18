/**
 * 1. ĐỊNH NGHĨA HÀM ĐĂNG XUẤT TOÀN CỤC (GLOBAL)
 */
window.logout = async function () {
    const token = localStorage.getItem("token");

    if (!confirm("Bạn có chắc chắn muốn đăng xuất không?")) return;

    try {
        await fetch("http://localhost:8080/api/auth/logout", {
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

/**
 * 1.5. TIỆN ÍCH ĐỌC ROLE TỪ localStorage (userInfo)
 */
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

function getAllowedPagesByRole(role) {
    // Quy ước: file nằm trong thư mục admin/
    // Admin: full
    if (role === "ADMIN") return null;

    // Staff: chỉ các nghiệp vụ vận hành
    if (role === "STAFF") {
        return new Set([
            "tongquan.html",        // dashboard
            "datcho.html",          // Quản lý Đặt bàn
            "donhang.html",         // Tiếp nhận Đơn hàng
            "qltrangthaiban.html",  // Quản lý Trạng thái bàn
            "goinv.html",           // Xử lý Hỗ trợ (Gọi nhân viên)
            "qlthanhtoan.html"      // Hoàn tất Thanh toán
        ]);
    }

    // Role khác: không cho vào admin area
    return new Set();
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

/**
 * 2. HÀM NẠP CÁC THÀNH PHẦN (SIDEBAR/HEADER)
 */
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

/**
 * 3. HÀM HIỂN THỊ THÔNG TIN NGƯỜI DÙNG LÊN HEADER
 * Khớp với cấu trúc dữ liệu từ dangnhap.js
 */
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

/**
 * 4. HÀM TỰ ĐỘNG ĐÁNH DẤU MENU ĐANG HOẠT ĐỘNG (ACTIVE)
 */
function highlightCurrentPage() {
    const currentPage = window.location.pathname.split("/").pop() || 'tongquan.html';
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href').split("/").pop();
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * 5. KHỞI CHẠY KHI TRANG WEB ĐÃ TẢI XONG DOM
 */
document.addEventListener("DOMContentLoaded", function() {
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
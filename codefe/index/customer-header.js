(function () {
    function getActiveQrTokenSafe() {
        try {
            if (typeof window.getActiveQrToken === "function") return window.getActiveQrToken() || "";
            var params = new URLSearchParams(window.location.search);
            var t = (params.get("t") || "").trim();
            if (t) {
                sessionStorage.setItem("activeQrToken", t);
                return t;
            }
            return sessionStorage.getItem("activeQrToken") || "";
        } catch {
            return "";
        }
    }

    function getUserScopeSafe() {
        try {
            var raw = localStorage.getItem("userInfo");
            var u = raw ? JSON.parse(raw) : {};
            if (u && u.userId != null && u.userId !== "") return "u_" + String(u.userId);
        } catch {}
        return "guest";
    }

    function getCartStorageKeySafe() {
        var token = getActiveQrTokenSafe();
        var scope = getUserScopeSafe();
        return token ? "gioHang_qr_" + token + "_" + scope : "gioHang_" + scope;
    }

    function withToken(href) {
        try {
            if (typeof window.appendQrToHref === "function") return window.appendQrToHref(href);
            var params = new URLSearchParams(window.location.search);
            var t = params.get("t");
            if (!t) return href;
            return href + (href.indexOf("?") >= 0 ? "&" : "?") + "t=" + encodeURIComponent(t);
        } catch {
            return href;
        }
    }

    function getCartCount() {
        try {
            var cart;
            if (typeof window.layGioHangChung === "function") {
                cart = window.layGioHangChung();
            } else {
                cart = JSON.parse(localStorage.getItem(getCartStorageKeySafe()) || "[]");
            }
            return (cart || []).reduce(function (s, i) { return s + (Number(i.soLuong) || 0); }, 0);
        } catch {
            return 0;
        }
    }

    function parseUser() {
        try {
            var raw = localStorage.getItem("userInfo");
            var u = raw ? JSON.parse(raw) : {};
            return {
                fullName: u.fullName || u.name || u.username || "",
                email: u.email || u.mail || "",
                phone: u.phone || u.phoneNumber || u.mobile || "",
                avatarUrl: u.avatarUrl || u.avatar || ""
            };
        } catch {
            return {};
        }
    }

    function initials(name) {
        var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "U";
        return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
    }

    function markActiveNav() {
        var p = (window.location.pathname || "").toLowerCase();
        var map = [
            ["home", ".nav-home"],
            ["menu", ".nav-menu"],
            ["datban", ".nav-datban"],
            ["danhmuc", ".nav-danhmuc"],
            ["lichsu", ".nav-lichsu"],
            ["danhgia", ".nav-danhgia"]
        ];
        map.forEach(function (item) {
            var el = document.querySelector(item[1]);
            if (!el) return;
            if (p.indexOf(item[0] + ".html") >= 0) el.classList.add("active");
            else el.classList.remove("active");
        });
    }

    function applyQrMode() {
        var token = getActiveQrTokenSafe();
        if (!token) return;

        var path = (window.location.pathname || "").toLowerCase();
        var allowPages = ["qr-menu.html", "menu-detail.html", "giohang.html"];
        var isAllowed = allowPages.some(function (p) { return path.indexOf(p) >= 0; });
        if (!isAllowed) {
            window.location.href = withToken("/index/qr-menu.html");
            return;
        }

        [".nav-home", ".nav-datban", ".nav-danhmuc", ".nav-danhgia"].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (el && el.parentElement) el.parentElement.style.display = "none";
        });

        var navMenu = document.querySelector(".nav-menu");
        if (navMenu) navMenu.href = withToken("/index/qr-menu.html");

        var ordersLink = document.getElementById("nav-orders-link");
        var ordersLabel = document.getElementById("nav-orders-label");
        if (ordersLink) {
            ordersLink.href = withToken("/index/giohang.html");
            ordersLink.classList.add("nav-orders");
            if (path.indexOf("giohang.html") >= 0) ordersLink.classList.add("active");
        }
        if (ordersLabel) ordersLabel.textContent = "Xem đơn hàng";

        var bookBtn = document.getElementById("btn-book-now");
        if (bookBtn) bookBtn.style.display = "none";
    }

    async function logout() {
        var token = localStorage.getItem("accessToken");
        try {
            if (token) {
                await fetch("http://localhost:8080/api/auth/logout", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token }
                });
            }
        } catch {}
        Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf("gioHang") === 0) localStorage.removeItem(k);
        });
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userInfo");
        window.location.href = "../dangnhap.html";
    }

    function bindHeaderData() {
        var u = parseUser();
        var name = u.fullName || "Khách hàng";
        var email = u.email || "Chưa cập nhật";
        var phone = u.phone || "Chưa cập nhật";

        var nameEl = document.getElementById("dropdownName");
        var emailEl = document.getElementById("dropdownEmail");
        var phoneEl = document.getElementById("dropdownPhone");
        if (nameEl) nameEl.textContent = name;
        if (emailEl) emailEl.textContent = email;
        if (phoneEl) phoneEl.textContent = phone;

        var avatarEls = [document.getElementById("userDropdown"), document.getElementById("dropdownAvatar")];
        avatarEls.forEach(function (el) {
            if (!el) return;
            if (u.avatarUrl) {
                el.style.backgroundImage = 'url("' + u.avatarUrl + '")';
                el.style.backgroundSize = "cover";
                el.style.backgroundPosition = "center";
                el.textContent = "";
            } else {
                el.textContent = initials(name);
                el.style.display = "inline-flex";
                el.style.alignItems = "center";
                el.style.justifyContent = "center";
                el.style.fontWeight = "700";
            }
        });

        var cartBtn = document.getElementById("header-cart-btn");
        if (cartBtn) cartBtn.onclick = function () { window.location.href = withToken("/index/giohang.html"); };

        var bookBtn = document.getElementById("btn-book-now");
        if (bookBtn) bookBtn.onclick = function () { window.location.href = withToken("/index/datban.html"); };

        var badge = document.getElementById("cart-badge");
        if (badge) {
            var total = getCartCount();
            badge.style.display = total > 0 ? "inline-block" : "none";
            badge.textContent = total > 99 ? "99+" : String(total);
        }

        var logoutBtn = document.getElementById("btn-logout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", function (e) {
                e.preventDefault();
                logout();
            });
        }

        markActiveNav();
        applyQrMode();
    }

    async function mountHeader() {
        var oldHeader = document.querySelector("header.navbar");
        if (!oldHeader) return;
        try {
            var res = await fetch("customer-header.html");
            if (!res.ok) return;
            var html = await res.text();
            var holder = document.createElement("div");
            holder.id = "customer-header-root";
            holder.innerHTML = html;
            oldHeader.replaceWith(holder);
            bindHeaderData();
        } catch {}
    }

    document.addEventListener("DOMContentLoaded", mountHeader);
})();

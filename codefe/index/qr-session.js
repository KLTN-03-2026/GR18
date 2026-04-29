/**
 * QR tại bàn: giữ token trong session, tách giỏ hàng theo bàn (localStorage key).
 * Dùng chung cho menu.js, menu-detail, giohang.
 */
(function () {
    var host = window.location.hostname || "";
    var isLocalHost = host === "localhost" || host === "127.0.0.1";
    // Cùng máy chạy Live Server + Spring: dùng đúng host trang (vd 127.0.0.1:5501 → API 127.0.0.1:8080).
    // Điện thoại quét QR mở http://IP-LAN:5500/... → API phải là http://IP-LAN:8080/api (cùng IP máy chạy BE).
    // Nếu từng lưu restaurant_api_base = http://127.0.0.1/... trên PC rồi mở trang từ IP LAN, bỏ qua để tránh gọi nhầm loopback.
    var defaultApi = isLocalHost
        ? ("http://" + host + ":8080/api")
        : (window.location.protocol + "//" + host + ":8080/api");
    var API = defaultApi;
    try {
        var rawStored = localStorage.getItem("restaurant_api_base");
        if (rawStored && String(rawStored).trim()) {
            var u = new URL(String(rawStored).trim());
            if (!isLocalHost && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) {
                // giữ defaultApi
            } else {
                API = String(rawStored).trim().replace(/\/+$/, "");
            }
        }
    } catch (e1) {
        var s = localStorage.getItem("restaurant_api_base");
        if (s && String(s).trim()) API = String(s).trim().replace(/\/+$/, "");
    }

    if (!host) API = "http://127.0.0.1:8080/api";

    window.RESTAURANT_API_BASE = API;

    function tokenFromUrl() {
        var p = new URLSearchParams(window.location.search);
        var byQuery = (
            p.get("t") ||
            p.get("token") ||
            p.get("qr") ||
            p.get("tableToken") ||
            p.get("qrCodeToken") ||
            ""
        ).trim();
        if (byQuery) return byQuery;

        // Hỗ trợ QR dạng /qr/{token}
        var path = window.location.pathname || "";
        var m = path.match(/\/qr\/([^/?#]+)/i);
        if (m && m[1]) return decodeURIComponent(m[1]).trim();
        return "";
    }

    /** Ưu tiên query hiện tại, không thì session đã lưu. */
    window.getActiveQrToken = function () {
        var u = tokenFromUrl();
        if (u) {
            try {
                sessionStorage.setItem("activeQrToken", u);
            } catch (e) {}
            return u;
        }
        try {
            return sessionStorage.getItem("activeQrToken") || "";
        } catch (e2) {
            return "";
        }
    };

    function getUserScope() {
        try {
            var raw = localStorage.getItem("userInfo");
            var u = raw ? JSON.parse(raw) : {};
            if (u && u.userId != null && u.userId !== "") return "u_" + String(u.userId);
        } catch (e) {}
        return "guest";
    }

    window.cartStorageKey = function () {
        var t = window.getActiveQrToken();
        if (!t) return "";
        var scope = getUserScope();
        return "gioHang_qr_" + t + "_" + scope;
    };

    window.appendQrToHref = function (href) {
        var t = window.getActiveQrToken();
        if (!t) return href;
        var sep = href.indexOf("?") >= 0 ? "&" : "?";
        return href + sep + "t=" + encodeURIComponent(t);
    };

    window.layGioHangChung = function () {
        var key = window.cartStorageKey();
        if (!key) return [];
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            return [];
        }
    };

    window.luuGioHangChung = function (cart) {
        var key = window.cartStorageKey();
        if (!key) return;
        try {
            localStorage.setItem(key, JSON.stringify(cart || []));
        } catch (e) {}
    };

    /** Chỉ hiện icon giỏ hàng trên header khi đã quét QR bàn (có ?t= hoặc session). */
    window.syncHeaderCartVisibility = function () {
        var t = "";
        try {
            t = (typeof window.getActiveQrToken === "function" && window.getActiveQrToken()) || "";
        } catch (e) {}
        document.querySelectorAll("#header-cart-wrap").forEach(function (el) {
            if (t) el.classList.remove("d-none");
            else el.classList.add("d-none");
        });
    };

    /** Giao diện quét QR: ẩn sớm Đăng nhập/Đăng ký trên trang menu tại bàn (trước khi header fetch xong). Danh sách trang trùng customer-header.js (QR_MENU_FLOW_PAGES). */
    (function syncQrMenuFlowClass() {
        try {
            var path = (window.location.pathname || "").toLowerCase();
            var menuFlow = ["qr-menu.html", "menu-detail.html", "giohang.html"].some(function (p) {
                return path.indexOf(p) >= 0;
            });
            var t = typeof window.getActiveQrToken === "function" && window.getActiveQrToken();
            if (!menuFlow || !t || !String(t).trim()) return;
            document.documentElement.classList.add("restaurant-qr-menu-flow");
            if (document.getElementById("restaurant-qr-header-style")) return;
            var s = document.createElement("style");
            s.id = "restaurant-qr-header-style";
            s.textContent = "html.restaurant-qr-menu-flow #header-auth-guest{display:none!important;}";
            document.head.appendChild(s);
        } catch (e) {}
    })();
})();

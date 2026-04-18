/**
 * QR tại bàn: giữ token trong session, tách giỏ hàng theo bàn (localStorage key).
 * Dùng chung cho menu.js, menu-detail, giohang.
 */
(function () {
    var host = window.location.hostname || "";
    var isLocalHost = host === "localhost" || host === "127.0.0.1";
    var defaultApi = isLocalHost
        ? "http://192.168.1.27:8080/api"
        : (window.location.protocol + "//" + host + ":8080/api");
    var API = localStorage.getItem("restaurant_api_base") || defaultApi;

    // Fallback khi mở file trực tiếp (file://) hoặc hostname rỗng.
    if (!host) API = "http://192.168.1.27:8080/api";

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
        var scope = getUserScope();
        return t ? "gioHang_qr_" + t + "_" + scope : "gioHang_" + scope;
    };

    window.appendQrToHref = function (href) {
        var t = window.getActiveQrToken();
        if (!t) return href;
        var sep = href.indexOf("?") >= 0 ? "&" : "?";
        return href + sep + "t=" + encodeURIComponent(t);
    };

    window.layGioHangChung = function () {
        try {
            return JSON.parse(localStorage.getItem(window.cartStorageKey())) || [];
        } catch (e) {
            return [];
        }
    };

    window.luuGioHangChung = function (cart) {
        localStorage.setItem(window.cartStorageKey(), JSON.stringify(cart || []));
    };
})();


(function () {
    // config.js đã set window.API_BASE theo hostname (local vs production).
    // qr-session.js chỉ cho phép override bằng localStorage["restaurant_api_base"] khi cần dev.
    var host = window.location.hostname || "";
    var isLocalHost = host === "localhost" || host === "127.0.0.1";
    var API = (window.API_BASE || "").replace(/\/+$/, "");
    try {
        var rawStored = localStorage.getItem("restaurant_api_base");
        if (rawStored && String(rawStored).trim()) {
            var u = new URL(String(rawStored).trim());
            if (!isLocalHost && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) {
                // Trang chạy ngoài LAN nhưng cache còn lưu loopback → bỏ qua override.
            } else {
                API = String(rawStored).trim().replace(/\/+$/, "");
                window.API_BASE = API;
            }
        }
    } catch (e1) {
        var s = localStorage.getItem("restaurant_api_base");
        if (s && String(s).trim()) {
            API = String(s).trim().replace(/\/+$/, "");
            window.API_BASE = API;
        }
    }

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

    var ACTIVE_ORDER_ID_KEY = "activeOrderId";

    window.getActiveOrderId = function () {
        try {
            var v = sessionStorage.getItem(ACTIVE_ORDER_ID_KEY);
            return v && String(v).trim() ? String(v).trim() : "";
        } catch (e) {
            return "";
        }
    };

    window.setActiveOrderId = function (orderId) {
        if (orderId == null || orderId === "") return;
        try {
            sessionStorage.setItem(ACTIVE_ORDER_ID_KEY, String(orderId));
        } catch (e) {}
    };

    window.clearActiveOrderId = function () {
        try {
            sessionStorage.removeItem(ACTIVE_ORDER_ID_KEY);
        } catch (e) {}
    };

    /**
     * Đồng bộ activeOrderId từ GET /tables/qr/{token}/active-order.
     * @returns {Promise<object|null>} đơn mở hoặc null
     */
    function applySyncedOpenOrder(order) {
        if (order && order.id != null) {
            window.setActiveOrderId(order.id);
            return order;
        }
        window.clearActiveOrderId();
        return null;
    }

    /** Fallback khi server chưa có GET /tables/qr/{token}/active-order */
    async function syncActiveOrderLegacy(token) {
        var res = await fetch(
            window.API_BASE + "/orders/guest/table/" + encodeURIComponent(token)
        );
        var json = await res.json().catch(function () {
            return {};
        });
        if (!res.ok || json.success === false) {
            return null;
        }
        var list = json.data != null ? json.data : json;
        if (!Array.isArray(list) || !list.length) {
            return null;
        }
        var open = list.find(function (o) {
            return o && o.paymentStatus !== "PAID";
        });
        return open || list[0];
    }

    window.syncActiveOrderFromApi = async function () {
        var token = typeof window.getActiveQrToken === "function" ? window.getActiveQrToken() : "";
        if (!token || !window.API_BASE) {
            window.clearActiveOrderId();
            return null;
        }
        try {
            var res = await fetch(
                window.API_BASE + "/tables/qr/" + encodeURIComponent(token) + "/active-order"
            );
            var json = await res.json().catch(function () {
                return {};
            });
            if (res.ok && json.success !== false) {
                return applySyncedOpenOrder(json.data != null ? json.data : null);
            }
            if (res.status === 404 || res.status === 405 || res.status >= 500) {
                var legacy = await syncActiveOrderLegacy(token);
                return applySyncedOpenOrder(legacy);
            }
            return null;
        } catch (e) {
            try {
                var legacyOrder = await syncActiveOrderLegacy(token);
                return applySyncedOpenOrder(legacyOrder);
            } catch (e2) {
                return null;
            }
        }
    };

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

    /** Icon giỏ: chỉ hiện khi có QR bàn; luôn ẩn ở trang đăng nhập / đăng ký. */
    window.syncHeaderCartVisibility = function () {
        var path = "";
        try {
            path = (window.location.pathname || "").toLowerCase();
        } catch (e) {}
        var hideOnAuthPages = path.indexOf("dangnhap.html") >= 0 || path.indexOf("dangky.html") >= 0;
        var t = "";
        try {
            t = (typeof window.getActiveQrToken === "function" && window.getActiveQrToken()) || "";
        } catch (e2) {}
        document.querySelectorAll("#header-cart-wrap").forEach(function (el) {
            if (hideOnAuthPages || !t || !String(t).trim()) el.classList.add("d-none");
            else el.classList.remove("d-none");
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

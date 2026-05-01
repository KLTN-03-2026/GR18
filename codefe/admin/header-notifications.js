/**
 * Chuông thông báo header: tổng hợp đơn mới, gọi NV, đặt bàn chờ + feed STOMP.
 * Phụ thuộc: SockJS, Stomp (nạp từ component-loader), Bootstrap dropdown.
 */
(function () {
    const API_BASE = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");
    const FEED_STORAGE_KEY = "adminHeaderNotifyFeedV1";
    const MAX_FEED = 24;
    /** Thời gian hiển thị popup giữa phía trên khi có thông báo mới (STOMP). */
    const HEADER_NOTIFY_TOAST_MS = 5000;
    let stompClient = null;
    let pollTimer = null;
    let refreshDebounce = null;

    function getToken() {
        return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
    }

    function wsUrl() {
        try {
            const u = new URL(API_BASE);
            return `${u.origin}/api/ws`;
        } catch {
            return "http://localhost:8080/api/ws";
        }
    }

    async function apiGet(path) {
        const token = getToken();
        if (!token) return null;
        const res = await fetch(`${API_BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) return null;
        return json.data;
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setBadge(total) {
        const badge = document.getElementById("admin-notify-badge");
        if (!badge) return;
        if (total > 0) {
            badge.textContent = total > 99 ? "99+" : String(total);
            badge.classList.remove("d-none");
        } else {
            badge.classList.add("d-none");
        }
    }

    function formatTime() {
        const d = new Date();
        return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }

    function loadFeedFromStorage() {
        try {
            const raw = sessionStorage.getItem(FEED_STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }

    function saveFeedToStorage(items) {
        try {
            sessionStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_FEED)));
        } catch (_) {}
    }

    function renderFeed(items) {
        const feed = document.getElementById("admin-notify-feed");
        const empty = document.getElementById("admin-notify-feed-empty");
        if (!feed) return;
        if (!items.length) {
            feed.innerHTML = "";
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");
        feed.innerHTML = items
            .map(
                (it) => `
            <div class="list-group-item list-group-item-action border-0 border-bottom border-secondary-subtle py-2 px-3 small">
                <div class="d-flex justify-content-between gap-2">
                    <span class="fw-semibold text-truncate">${escapeHtml(it.title)}</span>
                    <span class="text-secondary text-nowrap flex-shrink-0">${escapeHtml(it.time)}</span>
                </div>
                <div class="text-secondary mt-1">${escapeHtml(it.body)}</div>
                ${it.href ? `<a class="stretched-link" href="${escapeAttr(it.href)}" aria-hidden="true"></a>` : ""}
            </div>`
            )
            .join("");
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, "&#39;");
    }

    /** Popup giữa phía trên màn hình, tự ẩn sau ~5 giây (hoặc reset khi có tin mới). */
    function showHeaderNotifyToast(title, body, href) {
        let root = document.getElementById("admin-header-notify-toast");
        if (!root) {
            root = document.createElement("div");
            root.id = "admin-header-notify-toast";
            root.setAttribute("role", "status");
            root.setAttribute("aria-live", "polite");
            document.body.appendChild(root);
        }

        const safeTitle = escapeHtml(title);
        const safeBody = escapeHtml(body);
        const h = href ? String(href).trim() : "";
        const safeHref = h ? escapeAttr(h) : "";

        const inner = `
            <div class="admin-header-notify-toast__row">
                <span class="material-symbols-outlined admin-header-notify-toast__icon" aria-hidden="true">notifications_active</span>
                <div class="flex-grow-1 min-w-0">
                    <strong class="admin-header-notify-toast__title">${safeTitle}</strong>
                    <p class="admin-header-notify-toast__body mb-0">${safeBody}</p>
                    ${safeHref ? `<p class="admin-header-notify-toast__hint mb-0">${escapeHtml("Bấm để mở trang")}</p>` : ""}
                </div>
            </div>`;

        if (safeHref) {
            root.innerHTML = `<a class="admin-header-notify-toast__panel" href="${safeHref}">${inner}</a>`;
        } else {
            root.innerHTML = `<div class="admin-header-notify-toast__panel">${inner}</div>`;
        }

        root.classList.remove("admin-header-notify-toast--visible");
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                root.classList.add("admin-header-notify-toast--visible");
            });
        });

        clearTimeout(showHeaderNotifyToast._hideTimer);
        showHeaderNotifyToast._hideTimer = setTimeout(function () {
            root.classList.remove("admin-header-notify-toast--visible");
        }, HEADER_NOTIFY_TOAST_MS);
    }

    function pushFeedEntry(title, body, href) {
        const items = loadFeedFromStorage();
        items.unshift({ title, body, time: formatTime(), href: href || "" });
        saveFeedToStorage(items);
        renderFeed(loadFeedFromStorage());
        showHeaderNotifyToast(title, body, href || "");
    }

    async function refreshCounts() {
        const summary = document.getElementById("admin-notify-summary");
        const token = getToken();
        if (!token) {
            if (summary) summary.textContent = "Đăng nhập để xem thông báo.";
            setBadge(0);
            return;
        }

        const [orders, calls, reservations] = await Promise.all([
            apiGet("/staff/orders"),
            apiGet("/staff/call-staff"),
            apiGet("/staff/reservations/today")
        ]);

        const orderList = Array.isArray(orders) ? orders : [];
        const callList = Array.isArray(calls) ? calls : [];
        const resList = Array.isArray(reservations) ? reservations : [];

        const nNewOrders = orderList.filter((o) => o && o.status === "PENDING").length;
        const nCalls = callList.length;
        const nRes = resList.filter((r) => r && String(r.status || "").toUpperCase() === "PENDING").length;

        setText("admin-notify-count-orders", String(nNewOrders));
        setText("admin-notify-count-calls", String(nCalls));
        setText("admin-notify-count-reservations", String(nRes));

        const total = nNewOrders + nCalls + nRes;
        setBadge(total);

        if (summary) {
            if (total === 0) {
                summary.textContent = "Không có việc cần xử lý ngay.";
            } else {
                summary.textContent = `${total} mục cần xem: đơn mới ${nNewOrders}, gọi NV ${nCalls}, đặt bàn ${nRes}.`;
            }
        }
    }

    function scheduleRefresh() {
        clearTimeout(refreshDebounce);
        refreshDebounce = setTimeout(() => refreshCounts(), 600);
    }

    function connectStomp() {
        if (typeof SockJS === "undefined" || typeof Stomp === "undefined") return;
        if (stompClient && stompClient.connected) return;

        try {
            const socket = new SockJS(wsUrl());
            stompClient = Stomp.over(socket);
            stompClient.debug = function () {};

            stompClient.connect(
                {},
                function () {
                    stompClient.subscribe("/topic/orders/new", function (msg) {
                        let payload = null;
                        try {
                            payload = JSON.parse(msg.body);
                        } catch {
                            payload = null;
                        }
                        let id = null;
                        let tableNum = "";
                        if (payload && typeof payload === "object" && payload.orderId != null) {
                            id = payload.orderId;
                            tableNum = payload.tableNumber ? String(payload.tableNumber) : "";
                        } else if (typeof payload === "number") {
                            id = payload;
                        }
                        const label = id != null ? `#${id}` : "";
                        const extra = tableNum ? ` · ${tableNum}` : "";
                        pushFeedEntry(
                            "Đơn hàng mới",
                            `Có đơn mới ${label}${extra} từ khách.`,
                            "donhang.html"
                        );
                        scheduleRefresh();
                    });

                    stompClient.subscribe("/topic/staff/call", function (msg) {
                        let data = {};
                        try {
                            data = JSON.parse(msg.body);
                        } catch {
                            data = {};
                        }
                        const table = data.tableNumber != null ? `Bàn ${data.tableNumber}` : "Bàn";
                        const note = (data.note && String(data.note).trim()) || "Khách cần hỗ trợ.";
                        pushFeedEntry("Gọi nhân viên", `${table}: ${note}`, "goinv.html");
                        scheduleRefresh();
                    });

                    stompClient.subscribe("/topic/staff/notifications", function (msg) {
                        let data = {};
                        try {
                            data = JSON.parse(msg.body);
                        } catch {
                            data = {};
                        }
                        if (data.type === "RESERVATION_NEW") {
                            const name = data.customerName || "Khách";
                            const when = data.reservationTime || "";
                            pushFeedEntry(
                                "Đặt bàn mới",
                                `${name}${when ? " · " + when : ""}`,
                                "datcho.html"
                            );
                            scheduleRefresh();
                        }
                    });
                },
                function () {
                    stompClient = null;
                    setTimeout(connectStomp, 8000);
                }
            );
        } catch (e) {
            console.warn("STOMP không kết nối được:", e);
            stompClient = null;
        }
    }

    function bindClear() {
        document.getElementById("admin-notify-clear-feed")?.addEventListener("click", function () {
            sessionStorage.removeItem(FEED_STORAGE_KEY);
            renderFeed([]);
        });
    }

    window.initAdminHeaderNotifications = function () {
        if (window.__adminNotifyInited) return;
        window.__adminNotifyInited = true;

        renderFeed(loadFeedFromStorage());
        bindClear();
        refreshCounts();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(refreshCounts, 45000);
        connectStomp();
    };
})();

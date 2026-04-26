(function () {
    const API_BASE = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");

    function getToken() {
        return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
    }

    function $(id) {
        return document.getElementById(id);
    }

    function formatVnd(n) {
        const v = Number(n || 0);
        return v.toLocaleString("vi-VN") + " đ";
    }

    function localDateTimeParam(d, endOfDay) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}T${endOfDay ? "23:59:59" : "00:00:00"}`;
    }

    function greetingLine() {
        const h = new Date().getHours();
        if (h < 12) return "Chào buổi sáng";
        if (h < 18) return "Chào buổi chiều";
        return "Chào buổi tối";
    }

    function displayUserName() {
        try {
            const u = JSON.parse(localStorage.getItem("userInfo") || "{}");
            return u.fullName || u.email || u.phone || "Quản trị";
        } catch {
            return "Quản trị";
        }
    }

    async function apiGet(path) {
        const token = getToken();
        const res = await fetch(`${API_BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new Error(json.message || `Lỗi ${res.status}`);
        }
        return json.data;
    }

    function translateOrderStatus(s) {
        return (
            {
                PENDING: "Đơn mới",
                PREPARING: "Đang chuẩn bị",
                SERVING: "Đang phục vụ",
                COMPLETED: "Hoàn thành",
                CANCELLED: "Đã hủy"
            }[s] || s || "—"
        );
    }

    function badgeClass(status) {
        if (status === "COMPLETED") return "confirmed";
        if (status === "CANCELLED") return "text-error";
        if (status === "PENDING") return "bg-error-container text-on-error";
        return "tertiary";
    }

    function renderChart(dailyBreakdown) {
        const root = $("dash-chart-root");
        if (!root) return;
        const rows = Array.isArray(dailyBreakdown) ? dailyBreakdown : [];
        if (!rows.length) {
            root.innerHTML = '<p class="text-slate-400 small mb-0">Chưa có doanh thu trong 7 ngày gần đây.</p>';
            return;
        }
        const values = rows.map((r) => Number(r[1] || 0));
        const max = Math.max(...values, 1);
        root.innerHTML = `
            <div class="dash-chart-bars">
                ${rows
                    .map((r, i) => {
                        const rawLabel = r[0];
                        let label = String(i + 1);
                        if (rawLabel != null) {
                            const s = String(rawLabel);
                            const d = new Date(s);
                            if (!Number.isNaN(d.getTime())) {
                                label = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
                            } else if (s.length >= 10) {
                                label = s.slice(8, 10) + "/" + s.slice(5, 7);
                            }
                        }
                        const h = Math.round((values[i] / max) * 100);
                        return `<div class="dash-bar-col" title="${formatVnd(values[i])}">
                            <div class="dash-bar-fill" style="height:${Math.max(h, 6)}%"></div>
                            <span class="dash-bar-label">${label}</span>
                        </div>`;
                    })
                    .join("")}
            </div>
            <p class="small text-secondary mt-2 mb-0 text-center">7 ngày gần nhất (đơn đã thanh toán)</p>`;
    }

    function renderTopSelling(list) {
        const root = $("dash-top-selling");
        if (!root) return;
        const rows = Array.isArray(list) ? list.slice(0, 5) : [];
        if (!rows.length) {
            root.innerHTML = '<p class="small text-secondary mb-0">Chưa có dữ liệu bán chạy.</p>';
            return;
        }
        const rankClass = ["secondary-text", "primary-text", "tertiary-text"];
        root.innerHTML = rows
            .map((row, idx) => {
                const name = row[1] != null ? String(row[1]) : "Món";
                const qty = row[2] != null ? Number(row[2]) : 0;
                const rc = rankClass[Math.min(idx, 2)];
                return `<div class="food-item">
                    <div class="avatar ${rc} me-3">${String(idx + 1).padStart(2, "0")}</div>
                    <div class="flex-grow-1">
                        <p class="cust-name mb-0">${escapeHtml(name)}</p>
                        <p class="cust-sub mb-0">${qty.toLocaleString("vi-VN")} phần đã bán</p>
                    </div>
                </div>`;
            })
            .join("");
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function renderRecentOrders(orders) {
        const tbody = $("dash-recent-orders");
        if (!tbody) return;
        const rows = Array.isArray(orders) ? orders.slice(0, 8) : [];
        if (!rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="text-center py-4 text-secondary">Chưa có đơn đã thanh toán gần đây.</td></tr>';
            return;
        }
        tbody.innerHTML = rows
            .map((o) => {
                const when = o.paidAt || o.createdAt;
                let timeStr = "—";
                if (when) {
                    const d = new Date(when);
                    if (!Number.isNaN(d.getTime())) {
                        timeStr = d.toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                        });
                    }
                }
                const st = translateOrderStatus(o.status);
                const bc = badgeClass(o.status);
                return `<tr class="row-low">
                    <td class="px-4 fw-bold">#${o.id}</td>
                    <td>${escapeHtml(o.guestName || "Khách")}</td>
                    <td>${escapeHtml(timeStr)}</td>
                    <td>${formatVnd(o.totalAmount)}</td>
                    <td><span class="badge-status ${bc}">${escapeHtml(st)}</span></td>
                </tr>`;
            })
            .join("");
    }

    async function loadDashboard() {
        const tag = $("dash-tagline");
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);

        try {
            const [overview, top, revenue, recent] = await Promise.all([
                apiGet("/admin/statistics/overview"),
                apiGet("/admin/statistics/top-selling?limit=5"),
                apiGet(
                    `/admin/statistics/revenue?start=${encodeURIComponent(localDateTimeParam(start, false))}&end=${encodeURIComponent(localDateTimeParam(end, true))}`
                ),
                apiGet("/staff/orders/paid-recent?limit=8")
            ]);

            const rev = overview.todayRevenue != null ? Number(overview.todayRevenue) : 0;
            const pending = overview.pendingOrders != null ? Number(overview.pendingOrders) : 0;
            const paidToday = overview.ordersPaidToday != null ? Number(overview.ordersPaidToday) : 0;

            const elRev = $("stat-revenue");
            const elPending = $("stat-pending");
            const elPaid = $("stat-paid-today");
            if (elRev) elRev.textContent = formatVnd(rev);
            if (elPending) elPending.textContent = String(pending);
            if (elPaid) elPaid.textContent = String(paidToday);

            renderChart(revenue && revenue.dailyBreakdown);
            renderTopSelling(top);
            renderRecentOrders(recent);

            if (tag) {
                tag.innerHTML =
                    '<span class="material-symbols-outlined filled text-sm">auto_awesome</span> Dữ liệu theo hệ thống — ' +
                    pending +
                    " đơn đang cần xử lý.";
            }
        } catch (e) {
            console.warn(e);
            if (tag) {
                tag.innerHTML =
                    '<span class="material-symbols-outlined filled text-sm text-warning">warning</span> Không tải đủ dữ liệu: ' +
                    escapeHtml(e.message || "lỗi");
            }
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!getToken()) {
            window.location.href = "../dangnhap.html?next=admin/tongquan.html";
            return;
        }

        const greet = $("dash-greeting");
        if (greet) greet.textContent = greetingLine() + ", " + displayUserName() + "!";

        const dateEl = $("dash-date");
        if (dateEl) {
            const d = new Date();
            dateEl.textContent = d.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }

        loadDashboard();
        setInterval(loadDashboard, 120000);
    });
})();

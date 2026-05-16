(function () {

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

    function startOfLocalDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }

    function isSameLocalDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function parseDateInputValue(value) {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const [y, m, d] = value.split("-").map(Number);
        const parsed = new Date(y, m - 1, d);
        if (
            parsed.getFullYear() !== y ||
            parsed.getMonth() !== m - 1 ||
            parsed.getDate() !== d
        ) {
            return null;
        }
        return parsed;
    }

    function formatDateParam(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function updateDateDisplay(selectedDate) {
        const dateEl = $("dash-date");
        const picker = $("dash-date-picker");
        if (dateEl) {
            dateEl.textContent = selectedDate.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }
        if (picker) picker.value = formatDateParam(selectedDate);
    }

    function updateStatLabels(selectedDate) {
        const today = startOfLocalDay(new Date());
        const isToday = isSameLocalDay(selectedDate, today);
        const short = selectedDate.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });

        const revLabel = $("stat-label-revenue");
        const pendingLabel = $("stat-label-pending");
        const paidLabel = $("stat-label-paid");
        const revTrend = document.querySelector("#stat-revenue")?.closest(".stat-card")?.querySelector(".stat-trend");
        const pendingTrend = document.querySelector("#stat-pending")?.closest(".stat-card")?.querySelector(".stat-trend");
        const paidTrend = document.querySelector("#stat-paid-today")?.closest(".stat-card")?.querySelector(".stat-trend");

        if (revLabel) revLabel.textContent = isToday ? "Doanh thu hôm nay" : `Doanh thu ngày ${short}`;
        if (paidLabel) paidLabel.textContent = isToday ? "Đã thanh toán hôm nay" : `Đã thanh toán ngày ${short}`;
        if (pendingLabel) {
            pendingLabel.textContent = isToday ? "Đơn đang xử lý" : "Đơn đang xử lý (hiện tại)";
        }
        if (revTrend) revTrend.textContent = "Đơn đã thanh toán trong ngày";
        if (pendingTrend) {
            pendingTrend.textContent = isToday
                ? "Mới · Chuẩn bị · Phục vụ"
                : "Chỉ số realtime — không theo ngày đã chọn";
        }
        if (paidTrend) paidTrend.textContent = "Số đơn hoàn tất trong ngày";

        const chartTitle = $("dash-chart-title");
        const chartSub = $("dash-chart-subtitle");
        if (chartTitle) {
            chartTitle.textContent = isToday
                ? "Doanh thu 7 ngày gần nhất"
                : `Doanh thu 7 ngày (đến ${short})`;
        }
        if (chartSub) chartSub.textContent = "Theo ngày thanh toán";
    }

    function filterPaidOrdersByDate(orders, selectedDate) {
        const key = isoKeyLocal(selectedDate);
        return (Array.isArray(orders) ? orders : []).filter((o) => {
            if (!o || !o.paidAt) return false;
            const d = new Date(o.paidAt);
            return !Number.isNaN(d.getTime()) && isoKeyLocal(d) === key;
        });
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
        const res = await fetch(`${window.API_BASE}${path}`, {
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

    /** Khóa YYYY-MM-DD theo giờ local (đồng bộ param start/end của API). */
    function isoKeyLocal(d) {
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${mo}-${day}`;
    }

    /** Chỉ nhận chuối/ngày hợp lệ làm nhãn trục; không dùng slice() trên số tiền. */
    function dateKeyFromCell(v) {
        if (v == null || v === "") return null;
        if (typeof v === "object" && !Array.isArray(v)) {
            const y = v.year;
            const mo = v.monthValue != null ? v.monthValue : v.month != null ? v.month : null;
            const dd = v.dayOfMonth != null ? v.dayOfMonth : v.day != null ? v.day : null;
            if (y != null && mo != null && dd != null) {
                const d = new Date(Number(y), Number(mo) - 1, Number(dd));
                return Number.isNaN(d.getTime()) ? null : isoKeyLocal(d);
            }
            return null;
        }
        if (Array.isArray(v) && v.length >= 3 && typeof v[0] === "number") {
            const d = new Date(v[0], Number(v[1]) - 1, Number(v[2]));
            return Number.isNaN(d.getTime()) ? null : isoKeyLocal(d);
        }
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isFinite(n) && n >= 1596739200000 && n <= 2100840192000) {
            const d = new Date(n);
            return Number.isNaN(d.getTime()) ? null : isoKeyLocal(d);
        }
        const s = String(v).trim();
        const iso = /^(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
        if (iso) {
            const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
            return Number.isNaN(d.getTime()) ? null : isoKeyLocal(d);
        }
        const dGuess = new Date(s);
        if (!Number.isNaN(dGuess.getTime()) && !/^\d{8,}(\.\d+)?$/.test(s)) return isoKeyLocal(dGuess);
        return null;
    }

    function finiteAmount(cell) {
        const n = Number(cell);
        return Number.isFinite(n) ? n : NaN;
    }

    /** Một tuple [a,b]: thử đúng thứ tự (date, amount) và đảo chỗ — API đôi khi/ghi nhầm. */
    function decodeTuple(cell0, cell1) {
        const tryNorm = dateKeyFromCell(cell0);
        const a0 = finiteAmount(cell1);
        if (tryNorm && !Number.isNaN(a0)) return { key: tryNorm, amount: Math.max(a0, 0) };

        const trySwap = dateKeyFromCell(cell1);
        const a1 = finiteAmount(cell0);
        if (trySwap && !Number.isNaN(a1)) return { key: trySwap, amount: Math.max(a1, 0) };

        return null;
    }

    /** Một phần tử dailyBreakdown từ BE: mảng 2 ô hoặc map { date, revenue }… */
    function accumulateBreakdown(byKey, r) {
        if (!r) return;
        let parsed = null;

        if (Array.isArray(r) && r.length >= 2) {
            parsed = decodeTuple(r[0], r[1]);
        } else if (typeof r === "object" && !Array.isArray(r)) {
            const dateRaw =
                r.date != null ? r.date : r.day != null ? r.day : r.paidAt != null ? r.paidAt : r[0] != null ? r[0] : null;
            const amtRaw =
                r.revenue != null ? r.revenue : r.amount != null ? r.amount : r.total != null ? r.total : r[1];
            const k = dateKeyFromCell(dateRaw);
            const amt = finiteAmount(amtRaw);
            if (k && !Number.isNaN(amt)) parsed = { key: k, amount: Math.max(amt, 0) };

            if (!parsed && amtRaw !== undefined && dateRaw !== undefined) {
                parsed = decodeTuple(dateRaw, amtRaw);
            }
        }

        if (!parsed || !parsed.key) return;

        const prev = byKey[parsed.key] || 0;
        byKey[parsed.key] = prev + parsed.amount;
    }

    /** Luôn 7 cột tiếp nối từ periodStartLocal (00:00 local), có ngày 0 đồng. */
    function buildSevenDayBars(periodStartLocal, dailyBreakdown) {
        const byKey = Object.create(null);
        const rows = Array.isArray(dailyBreakdown) ? dailyBreakdown : [];
        for (let i = 0; i < rows.length; i++) accumulateBreakdown(byKey, rows[i]);

        const start = new Date(
            periodStartLocal.getFullYear(),
            periodStartLocal.getMonth(),
            periodStartLocal.getDate(),
            0,
            0,
            0,
            0
        );

        const out = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            const k = isoKeyLocal(d);
            out.push({
                label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
                amount: byKey[k] || 0
            });
        }
        return out;
    }

    function renderChart(periodStartLocal, dailyBreakdown) {
        const root = $("dash-chart-root");
        if (!root) return;

        const bars = buildSevenDayBars(periodStartLocal, dailyBreakdown);
        const values = bars.map((b) => b.amount);
        const max = Math.max(...values, 1);
        const hasAny = values.some((v) => v > 0);

        if (!hasAny) {
            root.innerHTML = '<p class="text-slate-400 small mb-0">Chưa có doanh thu trong 7 ngày gần đây.</p>';
            return;
        }

        root.innerHTML = `
            <div class="dash-chart-bars">
                ${bars
                    .map((b, i) => {
                        const h = Math.round((values[i] / max) * 100);
                        return `<div class="dash-bar-col" title="${formatVnd(values[i])}">
                            <div class="dash-bar-fill" style="height:${Math.max(h, 6)}%"></div>
                            <span class="dash-bar-label">${escapeHtml(b.label)}</span>
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

    async function loadDashboard(selectedDate) {
        const tag = $("dash-tagline");
        const anchor = startOfLocalDay(selectedDate || new Date());
        const today = startOfLocalDay(new Date());
        const isToday = isSameLocalDay(anchor, today);

        const chartStart = new Date(anchor);
        chartStart.setDate(chartStart.getDate() - 6);
        const rangeEndDay = isToday ? new Date() : anchor;

        updateDateDisplay(anchor);
        updateStatLabels(anchor);

        try {
            const dateQuery = encodeURIComponent(formatDateParam(anchor));
            const [overview, top, revenue, recent] = await Promise.all([
                apiGet(`/admin/statistics/overview?date=${dateQuery}`),
                apiGet("/admin/statistics/top-selling?limit=5"),
                apiGet(
                    `/admin/statistics/revenue?start=${encodeURIComponent(localDateTimeParam(chartStart, false))}&end=${encodeURIComponent(localDateTimeParam(rangeEndDay, true))}`
                ),
                apiGet("/staff/orders/paid-recent?limit=50")
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

            renderChart(chartStart, revenue && revenue.dailyBreakdown);
            renderTopSelling(top);
            renderRecentOrders(filterPaidOrdersByDate(recent, anchor).slice(0, 8));

            if (tag) {
                const dayLabel = anchor.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
                if (isToday) {
                    tag.innerHTML =
                        '<span class="material-symbols-outlined filled text-sm">auto_awesome</span> Dữ liệu theo hệ thống — ' +
                        pending +
                        " đơn đang cần xử lý.";
                } else {
                    tag.innerHTML =
                        '<span class="material-symbols-outlined filled text-sm">calendar_month</span> Thống kê ngày ' +
                        escapeHtml(dayLabel) +
                        " — " +
                        paidToday +
                        " đơn đã thanh toán.";
                }
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

        const picker = $("dash-date-picker");
        const today = startOfLocalDay(new Date());
        if (picker) {
            picker.max = formatDateParam(today);
            picker.value = formatDateParam(today);
            picker.addEventListener("change", function () {
                const picked = parseDateInputValue(picker.value);
                if (!picked) return;
                if (picked > today) {
                    picker.value = formatDateParam(today);
                    return;
                }
                loadDashboard(picked);
            });
        }

        updateDateDisplay(today);
        loadDashboard(today);

        setInterval(function () {
            const current = parseDateInputValue(picker && picker.value) || today;
            if (isSameLocalDay(current, today)) {
                loadDashboard(today);
            }
        }, 120000);
    });
})();

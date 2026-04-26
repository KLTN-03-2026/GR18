(function () {
    const API_BASE = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");
    let pendingCalls = [];
    let resolvedCalls = [];
    let currentFilter = "all";
    let pollTimer = null;

    function getToken() {
        return localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    }

    function formatTimeAgo(isoString) {
        if (!isoString) return "--";
        const diffMs = Date.now() - new Date(isoString).getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return "Vừa xong";
        const min = Math.floor(diffMs / 60000);
        if (min < 1) return "Vừa xong";
        if (min < 60) return `${min} phút trước`;
        const hour = Math.floor(min / 60);
        if (hour < 24) return `${hour} giờ trước`;
        const day = Math.floor(hour / 24);
        return `${day} ngày trước`;
    }

    function callRow(call, isResolved) {
        const tableNumber = call?.tableNumber || "--";
        const note = (call?.note || "").trim();
        const desc = note || "Khách cần nhân viên hỗ trợ tại bàn.";
        const timeText = formatTimeAgo(call?.createdAt);
        const statusBadge = isResolved
            ? '<span class="badge bg-success-subtle text-success px-3 py-1 rounded-pill smaller fw-bold">ĐÃ XỬ LÝ</span>'
            : '<span class="badge bg-tertiary-container text-on-tertiary px-3 py-1 rounded-pill smaller fw-bold">ĐANG CHỜ</span>';
        const actionBtn = isResolved
            ? '<button class="btn btn-icon-tool-success" disabled><span class="material-symbols-outlined fs-5">check_circle</span></button>'
            : `<button class="btn btn-icon-tool-success btn-resolve-call" data-id="${call.id}" title="Đánh dấu đã xử lý"><span class="material-symbols-outlined fs-5">done_all</span></button>`;

        return `
            <tr class="request-row">
                <td class="ps-4">
                    <div class="table-mini-num ${isResolved ? "bg-surface-highest text-secondary" : "bg-primary-container text-primary fw-800 ai-pulse"}">${tableNumber}</div>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <div class="icon-circle-sm ${isResolved ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}">
                            <span class="material-symbols-outlined fs-6">support_agent</span>
                        </div>
                        <div>
                            <p class="mb-0 fw-bold small">Yêu cầu hỗ trợ</p>
                            <p class="mb-0 smaller text-secondary">${desc}</p>
                        </div>
                    </div>
                </td>
                <td class="text-center"><span class="smaller text-secondary">${timeText}</span></td>
                <td>${statusBadge}</td>
                <td class="text-end pe-4">${actionBtn}</td>
            </tr>
        `;
    }

    function renderUrgentCard() {
        const urgent = pendingCalls[0] || null;
        const tableEl = document.getElementById("urgent-table-number");
        const timeEl = document.getElementById("urgent-time");
        const titleEl = document.getElementById("urgent-title");
        const noteEl = document.getElementById("urgent-note");
        const btnEl = document.getElementById("urgent-resolve-btn");
        const progressEl = document.getElementById("urgent-progress");
        if (!tableEl || !timeEl || !titleEl || !noteEl || !btnEl || !progressEl) return;

        if (!urgent) {
            tableEl.textContent = "--";
            timeEl.innerHTML = '<span class="material-symbols-outlined fs-6">schedule</span> --';
            titleEl.textContent = "Chưa có yêu cầu chờ xử lý";
            noteEl.textContent = "Khi khách gọi nhân viên, yêu cầu mới sẽ xuất hiện tại đây.";
            btnEl.disabled = true;
            btnEl.removeAttribute("data-id");
            progressEl.style.width = "0%";
            return;
        }

        const tableNumber = urgent.tableNumber || "--";
        const note = (urgent.note || "").trim();
        const minutes = Math.max(1, Math.floor((Date.now() - new Date(urgent.createdAt).getTime()) / 60000));
        const pressure = Math.min(100, 15 + minutes * 8);

        tableEl.textContent = tableNumber;
        timeEl.innerHTML = `<span class="material-symbols-outlined fs-6">schedule</span> ${formatTimeAgo(urgent.createdAt)}`;
        titleEl.textContent = `Yêu cầu từ bàn ${tableNumber}`;
        noteEl.textContent = note || "Khách đang chờ nhân viên hỗ trợ tại bàn.";
        btnEl.disabled = false;
        btnEl.setAttribute("data-id", String(urgent.id));
        progressEl.style.width = `${pressure}%`;
    }

    function renderTable() {
        const tbody = document.getElementById("call-request-body");
        if (!tbody) return;

        const rows = [];
        if (currentFilter === "all") {
            rows.push(...pendingCalls.map((c) => callRow(c, false)));
            rows.push(...resolvedCalls.map((c) => callRow(c, true)));
        } else {
            rows.push(...pendingCalls.map((c) => callRow(c, false)));
        }

        if (!rows.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-secondary">Không có yêu cầu nào trong danh sách.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rows.join("");
    }

    async function fetchCalls() {
        const token = getToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/staff/call-staff`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            console.warn(json.message || "Không tải được danh sách gọi nhân viên");
            pendingCalls = [];
            return;
        }
        const list = Array.isArray(json?.data) ? json.data : [];
        pendingCalls = list;
    }

    async function resolveCall(callId) {
        const token = getToken();
        if (!token || !callId) return;
        const res = await fetch(`${API_BASE}/staff/call-staff/${callId}/resolve`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
            alert(json?.message || "Không thể cập nhật trạng thái yêu cầu.");
            return;
        }
        const resolved = pendingCalls.find((c) => Number(c.id) === Number(callId));
        pendingCalls = pendingCalls.filter((c) => Number(c.id) !== Number(callId));
        if (resolved) {
            resolvedCalls.unshift({ ...resolved, isResolved: true, resolvedAt: new Date().toISOString() });
            resolvedCalls = resolvedCalls.slice(0, 50);
        }
        renderUrgentCard();
        renderTable();
    }

    async function refreshData() {
        try {
            await fetchCalls();
            renderUrgentCard();
            renderTable();
        } catch (e) {
            console.warn("Không thể tải danh sách gọi nhân viên:", e);
        }
    }

    function bindEvents() {
        const root = document;
        root.addEventListener("click", (e) => {
            const resolveBtn = e.target.closest(".btn-resolve-call");
            if (resolveBtn) {
                resolveCall(resolveBtn.getAttribute("data-id"));
                return;
            }
            const urgentBtn = e.target.closest("#urgent-resolve-btn");
            if (urgentBtn && urgentBtn.getAttribute("data-id")) {
                resolveCall(urgentBtn.getAttribute("data-id"));
                return;
            }
            const filterBtn = e.target.closest("[data-filter]");
            if (!filterBtn) return;
            currentFilter = filterBtn.getAttribute("data-filter") || "all";
            document.querySelectorAll("[data-filter]").forEach((btn) => {
                if (btn === filterBtn) {
                    btn.classList.add("btn-surface-high", "text-white", "rounded-3");
                    btn.classList.remove("text-secondary");
                } else {
                    btn.classList.remove("btn-surface-high", "text-white", "rounded-3");
                    btn.classList.add("text-secondary");
                }
            });
            renderTable();
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindEvents();
        refreshData();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(refreshData, 10000);
    });
})();

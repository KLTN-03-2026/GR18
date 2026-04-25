(function () {
    const API_BASE = "http://localhost:8080/api";
    const STATUS = {
        AVAILABLE: { label: "TRỐNG", cls: "empty-table" },
        OCCUPIED: { label: "ĐANG DÙNG", cls: "active-table" },
        RESERVED: { label: "ĐÃ ĐẶT", cls: "reserved-table" },
        CLEANING: { label: "CẦN DỌN", cls: "cleaning-table" }
    };
    let pollTimer = null;

    function token() {
        return localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    }

    function toast(message, kind) {
        const el = document.getElementById("table-status-toast");
        if (!el) return;
        const klass = kind === "error" ? "text-danger" : "text-success";
        el.className = `small ${klass}`;
        el.textContent = message || "";
    }

    function countByStatus(tables) {
        const c = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0 };
        tables.forEach((t) => {
            const s = String(t.status || "").toUpperCase();
            if (c[s] != null) c[s] += 1;
        });
        document.getElementById("count-available").textContent = `TRỐNG: ${c.AVAILABLE}`;
        document.getElementById("count-occupied").textContent = `ĐANG DÙNG: ${c.OCCUPIED}`;
        document.getElementById("count-reserved").textContent = `ĐÃ ĐẶT: ${c.RESERVED}`;
        document.getElementById("count-cleaning").textContent = `CẦN DỌN: ${c.CLEANING}`;
    }

    function statusOptions(current) {
        return ["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING"]
            .map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${STATUS[s].label}</option>`)
            .join("");
    }

    function cardHtml(table) {
        const status = String(table.status || "AVAILABLE").toUpperCase();
        const view = STATUS[status] || STATUS.AVAILABLE;
        return `
            <div class="col-6 col-sm-4 col-md-3">
                <div class="table-status-card p-3 rounded-4 bg-surface-container ${view.cls}">
                    <div class="d-flex justify-content-between mb-3">
                        <div class="table-number">${table.tableNumber || table.id}</div>
                        <span class="badge smaller px-2">${view.label}</span>
                    </div>
                    <div class="table-info">
                        <div class="smaller text-secondary mb-2">Sức chứa: ${table.capacity || "--"} khách</div>
                        <div class="smaller text-secondary mb-3">${table.location || "Khu vực chưa cập nhật"}</div>
                    </div>
                    <div class="hover-action mt-2 pt-2 border-top border-outline-variant/10">
                        <select class="form-select form-select-sm table-status-select" data-id="${table.id}">
                            ${statusOptions(status)}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    async function fetchTables() {
        const tk = token();
        if (!tk) return [];
        const res = await fetch(`${API_BASE}/tables/staff/tables`, {
            headers: { Authorization: `Bearer ${tk}` }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Không tải được danh sách bàn.");
        }
        return Array.isArray(json.data) ? json.data : [];
    }

    async function updateStatus(tableId, nextStatus) {
        const tk = token();
        if (!tk) return;
        const url = `${API_BASE}/tables/staff/tables/${encodeURIComponent(tableId)}/status?status=${encodeURIComponent(nextStatus)}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${tk}` }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Cập nhật trạng thái thất bại.");
        }
        toast("Đã cập nhật trạng thái bàn.", "success");
    }

    async function loadAndRender() {
        const grid = document.getElementById("table-status-grid");
        if (!grid) return;
        try {
            const tables = await fetchTables();
            countByStatus(tables);
            grid.innerHTML = tables.map(cardHtml).join("");
            if (!tables.length) {
                grid.innerHTML = '<div class="col-12 text-secondary">Chưa có bàn nào.</div>';
            }
        } catch (e) {
            grid.innerHTML = '<div class="col-12 text-danger">Không thể tải dữ liệu trạng thái bàn.</div>';
            toast(e.message || "Lỗi tải dữ liệu bàn.", "error");
        }
    }

    function bindEvents() {
        document.addEventListener("change", async (e) => {
            const sel = e.target.closest(".table-status-select");
            if (!sel) return;
            const tableId = sel.getAttribute("data-id");
            const next = sel.value;
            try {
                await updateStatus(tableId, next);
                await loadAndRender();
            } catch (err) {
                toast(err.message || "Không thể cập nhật trạng thái.", "error");
            }
        });

        document.getElementById("btn-refresh-table-status")?.addEventListener("click", loadAndRender);
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindEvents();
        loadAndRender();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(loadAndRender, 15000);
    });
})();

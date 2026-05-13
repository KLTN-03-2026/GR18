/**
 * Quản lý bàn & QR: danh sách, thêm / sửa / xóa (API admin), QR menu theo token.
 * GET/POST/PUT/DELETE /tables/admin/* — JWT ADMIN. API: window.RESTAURANT_API_BASE || https://gr18.onrender.com/api
 */
(function () {
    var API_BASE = (typeof window !== "undefined" && window.RESTAURANT_API_BASE) || "https://gr18.onrender.com/api";
    API_BASE = String(API_BASE).replace(/\/+$/, "");

    var FALLBACK_TABLES = [
        { tableNumber: "B01", capacity: 4, location: "Sảnh chính", qrCodeToken: "demo-qr-b01" },
        { tableNumber: "B02", capacity: 2, location: "Cửa sổ", qrCodeToken: "demo-qr-b02" },
        { tableNumber: "B03", capacity: 6, location: "Khu gia đình", qrCodeToken: "demo-qr-b03" },
        { tableNumber: "B04", capacity: 4, location: "Ngoài trời", qrCodeToken: "demo-qr-b04" },
        { tableNumber: "B05", capacity: 4, location: "Tầng 2", qrCodeToken: "demo-qr-b05" },
        { tableNumber: "B06", capacity: 2, location: "Quầy bar", qrCodeToken: "demo-qr-b06" }
    ];

    var STATUS_LABELS = {
        AVAILABLE: "Trống",
        OCCUPIED: "Đang dùng",
        RESERVED: "Đã đặt",
        CLEANING: "Đang dọn"
    };

    var tableFormMode = "add";
    var tableFormEditId = null;

    function getJwt() {
        return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
    }

    function isLoopbackUrl(u) {
        try {
            return u.hostname === "127.0.0.1" || u.hostname === "localhost";
        } catch (e) {
            return false;
        }
    }

    function computedMenuBase() {
        try {
            var u = new URL("../index/menu.html", window.location.href);
            return u.href.split("?")[0].replace(/\/$/, "");
        } catch (e2) {
            return "http://127.0.0.1:5500/index/menu.html";
        }
    }

    function getMenuBaseUrl() {
        var pageHost = window.location.hostname || "";
        var onLan = pageHost && pageHost !== "127.0.0.1" && pageHost !== "localhost";
        var computed = computedMenuBase();
        var saved = localStorage.getItem("restaurant_qr_menu_base");
        if (saved && saved.trim()) {
            var s = saved.trim().replace(/\/$/, "");
            if (onLan) {
                try {
                    if (isLoopbackUrl(new URL(s))) return computed;
                } catch (e) {}
            }
            return s;
        }
        return computed;
    }

    function setMenuBaseUrl(v) {
        if (v && v.trim()) localStorage.setItem("restaurant_qr_menu_base", v.trim().replace(/\/$/, ""));
        else localStorage.removeItem("restaurant_qr_menu_base");
    }

    function buildMenuUrl(token) {
        var base = getMenuBaseUrl();
        var sep = base.indexOf("?") >= 0 ? "&" : "?";
        return base + sep + "t=" + encodeURIComponent(token);
    }

    function normalizeRow(row) {
        var token = row.qrCodeToken || row.qr_code_token;
        var num = row.tableNumber || row.table_number;
        if (!token || !num) return null;
        return {
            id: row.id,
            tableNumber: num,
            capacity: row.capacity != null ? row.capacity : 4,
            location: row.location || "",
            qrCodeToken: token,
            isActive: row.isActive !== false,
            status: row.status
        };
    }

    function parseTablesResponse(json) {
        var raw = json.data != null ? json.data : json;
        var list = Array.isArray(raw) ? raw : raw && raw.content;
        if (!Array.isArray(list)) return null;
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var n = normalizeRow(list[i]);
            if (n) out.push(n);
        }
        return out;
    }

    async function fetchTablesFromApi() {
        var jwt = getJwt();
        if (!jwt) return null;
        try {
            var res = await fetch(API_BASE + "/tables/admin/tables", {
                headers: { Authorization: "Bearer " + jwt }
            });
            if (!res.ok) return null;
            var json = await res.json();
            var parsed = parseTablesResponse(json);
            return parsed !== null ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    async function apiJson(path, options) {
        var jwt = getJwt();
        if (!jwt) throw new Error("Vui lòng đăng nhập quyền Admin.");
        var headers = Object.assign({ Authorization: "Bearer " + jwt }, options.headers || {});
        var opts = Object.assign({}, options, { headers: headers });
        if (opts.body instanceof URLSearchParams && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        var res = await fetch(API_BASE + path, opts);
        var json = await res.json().catch(function () {
            return {};
        });
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Lỗi " + res.status);
        }
        return json;
    }

    function formatStatus(s) {
        if (s == null || s === "") return "—";
        var u = String(s).toUpperCase();
        return STATUS_LABELS[u] || String(s);
    }

    function escapeHtml(s) {
        if (s == null) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function clearEl(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    function makeQr(hostEl, text) {
        clearEl(hostEl);
        /* global QRCode */
        new QRCode(hostEl, {
            text: text,
            width: 140,
            height: 140,
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    function findQrDataUrl(hostEl) {
        var img = hostEl.querySelector("img");
        if (img && img.src && img.src.indexOf("data:") === 0) return img.src;
        var canvas = hostEl.querySelector("canvas");
        if (canvas) {
            try {
                return canvas.toDataURL("image/png");
            } catch (e) {}
        }
        return null;
    }

    function downloadDataUrl(dataUrl, filename) {
        var a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function getTableModal() {
        var el = document.getElementById("modal-table-form");
        if (!el || typeof bootstrap === "undefined") return null;
        return bootstrap.Modal.getOrCreateInstance(el);
    }

    function openTableForm(mode, row) {
        tableFormMode = mode;
        var modal = getTableModal();
        if (!modal) return;

        var numInput = document.getElementById("table-form-number");
        var capInput = document.getElementById("table-form-capacity");
        var locInput = document.getElementById("table-form-location");
        var hintAdd = document.getElementById("table-form-hint-add");
        var title = document.getElementById("modal-table-form-title");

        if (mode === "add") {
            tableFormEditId = null;
            if (title) title.textContent = "Thêm bàn";
            if (hintAdd) hintAdd.classList.remove("d-none");
            if (numInput) {
                numInput.readOnly = false;
                numInput.value = "";
            }
            if (capInput) capInput.value = "4";
            if (locInput) locInput.value = "";
        } else {
            tableFormEditId = row && row.id != null ? row.id : null;
            if (title) title.textContent = "Sửa bàn";
            if (hintAdd) hintAdd.classList.add("d-none");
            if (numInput) {
                numInput.readOnly = true;
                numInput.value = (row && row.tableNumber) || "";
            }
            if (capInput) capInput.value = row && row.capacity != null ? String(row.capacity) : "4";
            if (locInput) locInput.value = (row && row.location) || "";
        }
        modal.show();
    }

    async function submitTableForm() {
        var submitBtn = document.getElementById("btn-table-form-submit");
        var capInput = document.getElementById("table-form-capacity");
        var locInput = document.getElementById("table-form-location");
        var capacity = capInput ? parseInt(capInput.value, 10) : NaN;
        if (!capacity || capacity < 1) {
            alert("Sức chứa phải là số dương.");
            return;
        }
        var location = locInput ? locInput.value.trim() : "";

        submitBtn.disabled = true;
        try {
            if (tableFormMode === "add") {
                var numInput = document.getElementById("table-form-number");
                var tableNumber = numInput ? numInput.value.trim() : "";
                if (!tableNumber) {
                    alert("Nhập số bàn.");
                    return;
                }
                var params = new URLSearchParams();
                params.set("tableNumber", tableNumber);
                params.set("capacity", String(capacity));
                if (location) params.set("location", location);
                await apiJson("/tables/admin/tables", { method: "POST", body: params });
                alert("Đã tạo bàn.");
            } else {
                if (tableFormEditId == null) {
                    alert("Không nhận được mã bàn.");
                    return;
                }
                var paramsUp = new URLSearchParams();
                paramsUp.set("capacity", String(capacity));
                if (location) paramsUp.set("location", location);
                await apiJson("/tables/admin/tables/" + encodeURIComponent(tableFormEditId), {
                    method: "PUT",
                    body: paramsUp
                });
                alert("Đã cập nhật bàn.");
            }
            var inst = document.getElementById("modal-table-form");
            if (inst && typeof bootstrap !== "undefined") {
                var m = bootstrap.Modal.getInstance(inst);
                if (m) m.hide();
            }
            await run();
        } catch (e) {
            alert(e.message || "Thao tác thất bại.");
        } finally {
            submitBtn.disabled = false;
        }
    }

    async function deleteTableRow(idx) {
        var row = window.__qrTablesCache && window.__qrTablesCache[idx];
        if (!row || row.id == null) return;
        if (!confirm("Xóa bàn " + row.tableNumber + "? Bàn đang có khách (OCCUPIED) sẽ không xóa được.")) return;
        try {
            await apiJson("/tables/admin/tables/" + encodeURIComponent(row.id), { method: "DELETE" });
            alert("Đã xóa bàn.");
            await run();
        } catch (e) {
            alert(e.message || "Không xóa được bàn.");
        }
    }

    function render(tables) {
        var listRoot = document.getElementById("qr-list-root");
        var tbody = document.getElementById("tables-qr-tbody");
        var statTotal = document.getElementById("stat-total-tables");
        var statQr = document.getElementById("stat-qr-active");

        window.__qrTablesCache = tables;

        if (statTotal) statTotal.textContent = String(tables.length);
        if (statQr) statQr.textContent = String(tables.filter(function (t) { return t.qrCodeToken; }).length);

        if (listRoot) {
            clearEl(listRoot);
            if (!tables.length) {
                listRoot.innerHTML =
                    '<p class="text-secondary small mb-0">Chưa có bàn. Dùng nút <strong>Thêm bàn</strong> (cần quyền Admin).</p>';
            } else {
                tables.forEach(function (t, idx) {
                    var url = buildMenuUrl(t.qrCodeToken);
                    var wrap = document.createElement("div");
                    wrap.className =
                        "qr-item d-flex align-items-center justify-content-between p-3 rounded-4 mb-3 border border-outline-variant/10";
                    wrap.innerHTML =
                        '<div class="d-flex align-items-center gap-4 flex-grow-1 min-w-0">' +
                        '<div class="qr-box bg-white rounded-3 p-1 shadow-sm flex-shrink-0" id="qr-host-' +
                        idx +
                        '"></div>' +
                        '<div class="min-w-0">' +
                        '<p class="mb-0 fw-bold text-on-surface fs-6">Bàn ' +
                        escapeHtml(t.tableNumber) +
                        "</p>" +
                        '<p class="mb-0 text-secondary smaller text-truncate">' +
                        escapeHtml(t.location || "—") +
                        " · " +
                        (t.capacity || "—") +
                        " khách</p>" +
                        '<p class="mb-0 smaller text-muted text-break mt-1 qr-url-preview" style="font-size:11px;max-height:2.6em;overflow:hidden"></p>' +
                        "</div></div>" +
                        '<div class="d-flex gap-2 flex-shrink-0">' +
                        '<button type="button" class="btn btn-icon-tool btn-copy-url" data-idx="' +
                        idx +
                        '" title="Sao chép URL"><span class="material-symbols-outlined fs-5">content_copy</span></button>' +
                        '<button type="button" class="btn btn-icon-tool btn-primary-soft btn-dl-qr" data-idx="' +
                        idx +
                        '" title="Tải QR PNG"><span class="material-symbols-outlined fs-5">download</span></button>' +
                        "</div>";
                    var prev = wrap.querySelector(".qr-url-preview");
                    if (prev) {
                        prev.textContent = url;
                        prev.setAttribute("title", url);
                    }
                    listRoot.appendChild(wrap);
                    var host = document.getElementById("qr-host-" + idx);
                    if (host) makeQr(host, url);
                });
            }

            listRoot.querySelectorAll(".btn-copy-url").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var i = parseInt(btn.getAttribute("data-idx"), 10);
                    var row = window.__qrTablesCache && window.__qrTablesCache[i];
                    var u = row ? buildMenuUrl(row.qrCodeToken) : "";
                    if (!u) return;
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(u).then(
                            function () {
                                alert("Đã sao chép URL menu.");
                            },
                            function () {
                                prompt("Sao chép thủ công:", u);
                            }
                        );
                    } else {
                        prompt("Sao chép thủ công:", u);
                    }
                });
            });
            listRoot.querySelectorAll(".btn-dl-qr").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var i = parseInt(btn.getAttribute("data-idx"), 10);
                    var host = document.getElementById("qr-host-" + i);
                    if (!host) return;
                    var dataUrl = findQrDataUrl(host);
                    if (!dataUrl) {
                        alert("Không đọc được ảnh QR.");
                        return;
                    }
                    var t = tables[i];
                    downloadDataUrl(dataUrl, "QR-ban-" + (t && t.tableNumber ? t.tableNumber : i) + ".png");
                });
            });
        }

        if (tbody) {
            clearEl(tbody);
            if (!tables.length) {
                var tr0 = document.createElement("tr");
                tr0.className = "table-row-item";
                tr0.innerHTML =
                    '<td colspan="6" class="text-secondary small ps-3 py-3">Chưa có bàn nào.</td>';
                tbody.appendChild(tr0);
            } else {
                var canCrud = !!window.__tablesFromApi;
                tables.forEach(function (t, idx) {
                    var url = buildMenuUrl(t.qrCodeToken);
                    var statusLabel = formatStatus(t.status);
                    var qrBadge =
                        t.qrCodeToken && t.isActive !== false
                            ? '<span class="badge-status-glow bg-secondary-container/20 text-secondary fw-bold">Hoạt động</span>'
                            : '<span class="badge-status-glow bg-surface-highest/30 text-muted fw-bold">—</span>';
                    var crudBtns = "";
                    if (canCrud && t.id != null) {
                        crudBtns =
                            '<button type="button" class="btn btn-icon-tool-sm me-1 btn-edit-table" data-idx="' +
                            idx +
                            '" title="Sửa"><span class="material-symbols-outlined fs-5">edit</span></button>' +
                            '<button type="button" class="btn btn-icon-tool-sm me-2 btn-del-table" data-idx="' +
                            idx +
                            '" title="Xóa"><span class="material-symbols-outlined fs-5">delete</span></button>';
                    }
                    var tr = document.createElement("tr");
                    tr.className = "table-row-item";
                    tr.innerHTML =
                        '<td class="ps-3 fw-bold">' +
                        escapeHtml(t.tableNumber) +
                        "</td>" +
                        '<td class="text-secondary">' +
                        escapeHtml(t.location || "—") +
                        "</td>" +
                        '<td><span class="badge bg-surface-container-highest text-white px-3 py-2 rounded-pill">' +
                        escapeHtml(String(t.capacity || "—")) +
                        "</span></td>" +
                        '<td>' +
                        qrBadge +
                        '<span class="d-block smaller text-secondary mt-1">' +
                        escapeHtml(statusLabel) +
                        "</span></td>" +
                        '<td class="text-secondary small">—</td>' +
                        '<td class="text-end pe-3">' +
                        crudBtns +
                        '<button type="button" class="btn btn-icon-tool-sm btn-dl-row" data-idx="' +
                        idx +
                        '" title="Tải QR"><span class="material-symbols-outlined fs-5">download</span></button>' +
                        "</td>";
                    tbody.appendChild(tr);
                });
                tbody.querySelectorAll(".btn-dl-row").forEach(function (btn) {
                    btn.addEventListener("click", function () {
                        var i = parseInt(btn.getAttribute("data-idx"), 10);
                        var host = document.getElementById("qr-host-" + i);
                        if (!host) return;
                        var dataUrl = findQrDataUrl(host);
                        if (!dataUrl) {
                            alert("Không đọc được ảnh QR.");
                            return;
                        }
                        var t = tables[i];
                        downloadDataUrl(dataUrl, "QR-ban-" + (t && t.tableNumber ? t.tableNumber : i) + ".png");
                    });
                });
                tbody.querySelectorAll(".btn-edit-table").forEach(function (btn) {
                    btn.addEventListener("click", function () {
                        var i = parseInt(btn.getAttribute("data-idx"), 10);
                        var row = window.__qrTablesCache && window.__qrTablesCache[i];
                        if (row && row.id != null) openTableForm("edit", row);
                    });
                });
                tbody.querySelectorAll(".btn-del-table").forEach(function (btn) {
                    btn.addEventListener("click", function () {
                        var i = parseInt(btn.getAttribute("data-idx"), 10);
                        deleteTableRow(i);
                    });
                });
            }
        }
    }

    async function init() {
        var input = document.getElementById("qr-menu-base-url");
        if (input) {
            input.value = getMenuBaseUrl();
            input.addEventListener("change", function () {
                setMenuBaseUrl(input.value);
                run();
            });
        }

        document.getElementById("btn-download-all-qr")?.addEventListener("click", async function () {
            var tables = window.__qrTablesCache || [];
            for (var i = 0; i < tables.length; i++) {
                var host = document.getElementById("qr-host-" + i);
                if (!host) continue;
                var dataUrl = findQrDataUrl(host);
                if (dataUrl) {
                    downloadDataUrl(dataUrl, "QR-ban-" + tables[i].tableNumber + ".png");
                    await new Promise(function (r) {
                        setTimeout(r, 350);
                    });
                }
            }
        });

        document.getElementById("btn-floor-editor-placeholder")?.addEventListener("click", function () {
            alert("Tính năng chỉnh sửa sơ đồ mặt bằng đang được phát triển.");
        });

        document.getElementById("btn-add-table")?.addEventListener("click", function () {
            if (!getJwt()) {
                alert("Vui lòng đăng nhập quyền Admin để thêm bàn.");
                return;
            }
            openTableForm("add");
        });

        document.getElementById("btn-table-form-submit")?.addEventListener("click", function () {
            submitTableForm();
        });

        document.getElementById("modal-table-form")?.addEventListener("hidden.bs.modal", function () {
            tableFormEditId = null;
        });

        await run();
    }

    async function run() {
        var listRoot = document.getElementById("qr-list-root");
        if (listRoot && !listRoot.querySelector(".qr-item")) {
            listRoot.innerHTML = '<p class="text-secondary small">Đang tải danh sách bàn…</p>';
        }
        var fromApi = await fetchTablesFromApi();
        var tables;
        if (fromApi !== null) {
            window.__tablesFromApi = true;
            tables = fromApi;
        } else {
            window.__tablesFromApi = false;
            tables = FALLBACK_TABLES;
            var listRoot2 = document.getElementById("qr-list-root");
            if (listRoot2 && !document.getElementById("qr-api-warn")) {
                var warn = document.createElement("div");
                warn.className = "alert alert-warning small py-2 mb-3";
                warn.id = "qr-api-warn";
                warn.textContent = "Không kết nối được API — đang hiển thị dữ liệu mẫu. Thao tác thêm/sửa/xóa cần quyền Admin và backend.";
                listRoot2.prepend(warn);
            }
        }
        render(tables);
    }

    document.addEventListener("DOMContentLoaded", init);
})();

/**
 * Quản lý QR từng bàn: sinh ảnh QR (URL menu + ?t=token), tải xuống, đồng bộ token với DB seed V1.0.7.
 * JWT: GET /tables/admin/tables (context-path /api → .../api/tables/...), chỉ ADMIN.
 */
(function () {
    var API_BASE = "http://localhost:8080/api";

    var FALLBACK_TABLES = [
        { tableNumber: "B01", capacity: 4, location: "Sảnh chính", qrCodeToken: "demo-qr-b01" },
        { tableNumber: "B02", capacity: 2, location: "Cửa sổ", qrCodeToken: "demo-qr-b02" },
        { tableNumber: "B03", capacity: 6, location: "Khu gia đình", qrCodeToken: "demo-qr-b03" },
        { tableNumber: "B04", capacity: 4, location: "Ngoài trời", qrCodeToken: "demo-qr-b04" },
        { tableNumber: "B05", capacity: 4, location: "Tầng 2", qrCodeToken: "demo-qr-b05" },
        { tableNumber: "B06", capacity: 2, location: "Quầy bar", qrCodeToken: "demo-qr-b06" }
    ];

    function isLoopbackUrl(u) {
        try {
            return u.hostname === "127.0.0.1" || u.hostname === "localhost";
        } catch (e) {
            return false;
        }
    }

    function computedMenuBase() {
        try {
            // Cùng host/port với trang admin đang mở (localhost, IP Wi‑Fi tạm, hay domain — đổi theo mạng, không hardcode IP ở đây)
            // Muốn giao diện landing riêng: gõ thủ công .../index/qr-menu.html
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
            qrCodeToken: token
        };
    }

    function parseTablesResponse(json) {
        var raw = json.data != null ? json.data : json;
        var list = Array.isArray(raw) ? raw : raw && raw.content;
        if (!Array.isArray(list) || !list.length) return null;
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var n = normalizeRow(list[i]);
            if (n) out.push(n);
        }
        return out.length ? out : null;
    }

    async function fetchTablesFromApi() {
        var jwt = localStorage.getItem("accessToken") || localStorage.getItem("token");
        if (!jwt) return null;
        /* Chi ADMIN: GET /tables/admin/tables. */
        try {
            var res = await fetch(API_BASE + "/tables/admin/tables", {
                headers: { Authorization: "Bearer " + jwt }
            });
            if (!res.ok) return null;
            var json = await res.json();
            return parseTablesResponse(json);
        } catch (e) {
            return null;
        }
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
            tables.forEach(function (t, idx) {
                var url = buildMenuUrl(t.qrCodeToken);
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
                    '<td><span class="badge-status-glow bg-secondary-container/20 text-secondary fw-bold">Hoạt động</span></td>' +
                    '<td class="text-secondary small">—</td>' +
                    '<td class="text-end pe-3">' +
                    '<button type="button" class="btn btn-icon-tool-sm me-2 btn-dl-row" data-idx="' +
                    idx +
                    '"><span class="material-symbols-outlined fs-5">download</span></button>' +
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

        await run();
    }

    async function run() {
        var listRoot = document.getElementById("qr-list-root");
        if (listRoot && !listRoot.querySelector(".qr-item")) {
            listRoot.innerHTML = '<p class="text-secondary small">Đang tải danh sách bàn…</p>';
        }
        var fromApi = await fetchTablesFromApi();
        var tables = fromApi && fromApi.length ? fromApi : FALLBACK_TABLES;
        render(tables);
    }

    document.addEventListener("DOMContentLoaded", init);
})();

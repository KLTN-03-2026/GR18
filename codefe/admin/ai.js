(function () {
    var API_BASE = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");

    /** Thứ tự id món ưu tiên (giữ thứ tự chọn). */
    var pinnedOrder = [];
    var menuItemsCache = [];
    var searchDebounce = null;

    function getToken() {
        return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
    }

    function $(id) {
        return document.getElementById(id);
    }

    function esc(s) {
        if (s == null) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    function formatVnd(n) {
        var v = Number(n);
        if (isNaN(v)) return "—";
        return v.toLocaleString("vi-VN") + " đ";
    }

    async function apiGet(path) {
        var res = await fetch(API_BASE + path, {
            headers: { Authorization: "Bearer " + getToken() }
        });
        var json = await res.json().catch(function () {
            return {};
        });
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Lỗi " + res.status);
        }
        return json.data;
    }

    async function apiPut(path, body) {
        var res = await fetch(API_BASE + path, {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + getToken(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        var json = await res.json().catch(function () {
            return {};
        });
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Lỗi " + res.status);
        }
        return json.data;
    }

    function setChecked(id, v) {
        var el = $(id);
        if (el) el.checked = !!v;
    }

    function setVal(id, v) {
        var el = $(id);
        if (el) el.value = v != null ? v : "";
    }

    function parsePinnedJson(jsonStr) {
        pinnedOrder = [];
        if (!jsonStr || !String(jsonStr).trim()) return;
        try {
            var arr = JSON.parse(jsonStr);
            if (Array.isArray(arr)) {
                arr.forEach(function (x) {
                    var n = Number(x);
                    if (n > 0 && pinnedOrder.indexOf(n) < 0) pinnedOrder.push(n);
                });
            }
        } catch (e) {
            pinnedOrder = [];
        }
    }

    function pinnedJsonString() {
        return JSON.stringify(pinnedOrder);
    }

    function togglePinnedId(id, checked) {
        var idx = pinnedOrder.indexOf(id);
        if (checked) {
            if (idx < 0) pinnedOrder.push(id);
        } else {
            if (idx >= 0) pinnedOrder.splice(idx, 1);
        }
        updatePinnedCount();
    }

    function updatePinnedCount() {
        var el = $("ai-pinned-count");
        if (el) el.textContent = "Đã chọn: " + pinnedOrder.length + " món";
    }

    function normalizeSearch(s) {
        return String(s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    function renderMenuPicker() {
        var listEl = $("ai-menu-picker-list");
        var ph = $("ai-menu-picker-placeholder");
        if (!listEl) return;

        var q = normalizeSearch($("ai-menu-search") && $("ai-menu-search").value);
        if (!menuItemsCache.length) {
            if (ph) {
                ph.classList.remove("d-none");
                ph.textContent = "Chưa có món trong hệ thống.";
            }
            listEl.classList.add("d-none");
            listEl.innerHTML = "";
            return;
        }
        if (ph) ph.classList.add("d-none");
        listEl.classList.remove("d-none");

        var rows = menuItemsCache.filter(function (m) {
            if (m.isActive === false) return false;
            if (!q) return true;
            var name = normalizeSearch(m.name || "");
            var cat = normalizeSearch(m.categoryName || "");
            return name.indexOf(q) >= 0 || cat.indexOf(q) >= 0;
        });

        if (!rows.length) {
            listEl.innerHTML = '<p class="text-secondary small mb-0 py-2 px-2">Không có món khớp tìm kiếm.</p>';
            return;
        }

        listEl.innerHTML = rows
            .map(function (m) {
                var id = Number(m.id);
                var checked = pinnedOrder.indexOf(id) >= 0 ? " checked" : "";
                var price = formatVnd(m.price);
                var cat = esc(m.categoryName || "—");
                var av = m.isAvailable === false ? " <span class=\"badge bg-secondary small\">Tạm hết</span>" : "";
                return (
                    "<label class=\"ai-menu-pick-row d-flex align-items-center gap-3 px-2 py-2 rounded-2 mb-1\" style=\"cursor:pointer;\">" +
                    "<input type=\"checkbox\" class=\"form-check-input flex-shrink-0 ai-pick-cb\" data-mid=\"" +
                    id +
                    "\"" +
                    checked +
                    " />" +
                    "<div class=\"flex-grow-1 min-w-0\">" +
                    "<div class=\"fw-semibold text-on-surface text-truncate\">" +
                    esc(m.name) +
                    av +
                    "</div>" +
                    "<div class=\"small text-secondary\">" +
                    cat +
                    " · " +
                    esc(price) +
                    "</div></div>" +
                    "<span class=\"small text-slate flex-shrink-0\">#" +
                    id +
                    "</span></label>"
                );
            })
            .join("");

        listEl.querySelectorAll(".ai-pick-cb").forEach(function (cb) {
            cb.addEventListener("change", function () {
                var mid = parseInt(cb.getAttribute("data-mid"), 10);
                if (!isNaN(mid)) togglePinnedId(mid, cb.checked);
            });
        });
    }

    async function loadMenuItems() {
        var data = await apiGet("/admin/menu-items");
        menuItemsCache = Array.isArray(data) ? data : [];
        menuItemsCache.sort(function (a, b) {
            var na = (a.name || "").localeCompare(b.name || "", "vi");
            return na;
        });
        renderMenuPicker();
        updatePinnedCount();
    }

    async function loadConfig() {
        var c = await apiGet("/admin/ai/config");
        setChecked("ai-enabled", c.aiEnabled);
        setChecked("ai-gemini-enabled", c.geminiEnabled);
        setChecked("ai-anonymize", c.anonymizeAnalytics !== false);
        setVal("ai-timeout-ms", c.geminiTimeoutMs != null ? c.geminiTimeoutMs : 2800);
        parsePinnedJson(c.pinnedMenuItemIdsJson || "[]");
        updatePinnedCount();
        renderMenuPicker();

        var badge = $("ai-key-badge");
        if (badge) {
            if (c.geminiKeyConfigured) {
                badge.textContent = "Đã cấu hình key Gemini (env)";
                badge.className = "badge bg-secondary-container-soft text-secondary rounded-pill px-3 py-2";
            } else {
                badge.textContent = "Chưa có GEMINI_API_KEY — chỉ gợi ý theo rule + DB";
                badge.className = "badge bg-error-container-soft text-warning rounded-pill px-3 py-2";
            }
        }
        var up = $("ai-config-updated");
        if (up && c.updatedAt) {
            up.textContent = "Cập nhật lần cuối: " + new Date(c.updatedAt).toLocaleString("vi-VN");
        }
    }

    async function loadStats() {
        var s = await apiGet("/admin/ai/stats");
        var t = $("ai-stat-total");
        var a = $("ai-stat-accepted");
        var r = $("ai-stat-rate");
        if (t) t.textContent = String(s.totalSuggestions != null ? s.totalSuggestions : 0);
        if (a) a.textContent = String(s.totalAccepted != null ? s.totalAccepted : 0);
        if (r) {
            var pct = (s.acceptanceRate != null ? s.acceptanceRate * 100 : 0).toFixed(2);
            r.textContent = pct + "%";
        }
        var srcBox = $("ai-stat-by-source");
        if (srcBox && s.suggestionsBySource) {
            var parts = [];
            Object.keys(s.suggestionsBySource).forEach(function (k) {
                parts.push(esc(k) + ": " + s.suggestionsBySource[k]);
            });
            srcBox.textContent = parts.length ? parts.join(" · ") : "—";
        }
    }

    async function loadRecent() {
        var rows = await apiGet("/admin/ai/suggestions/recent");
        var tbody = $("ai-log-tbody");
        if (!tbody) return;
        if (!rows || !rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="text-secondary small py-3">Chưa có lượt gợi ý nào được ghi nhận.</td></tr>';
            return;
        }
        tbody.innerHTML = rows
            .map(function (row) {
                var acc = row.acceptedMenuItemId != null ? "#" + row.acceptedMenuItemId : "—";
                var at = row.acceptedAt ? new Date(row.acceptedAt).toLocaleString("vi-VN") : "—";
                return (
                    "<tr><td class=\"small\">" +
                    esc(row.id) +
                    "</td>" +
                    "<td class=\"small\">" +
                    esc(new Date(row.createdAt).toLocaleString("vi-VN")) +
                    "</td>" +
                    "<td><span class=\"badge badge-status-ai\">" +
                    esc(row.source) +
                    "</span></td>" +
                    "<td>" +
                    (row.suggestedCount != null ? row.suggestedCount : 0) +
                    "</td>" +
                    "<td class=\"small\">" +
                    acc +
                    "</td>" +
                    "<td class=\"small\">" +
                    at +
                    "</td></tr>"
                );
            })
            .join("");
    }

    async function saveConfig() {
        var btn = $("ai-btn-save");
        if (btn) btn.disabled = true;
        try {
            var body = {
                aiEnabled: $("ai-enabled").checked,
                geminiEnabled: $("ai-gemini-enabled").checked,
                anonymizeAnalytics: $("ai-anonymize").checked,
                pinnedMenuItemIdsJson: pinnedJsonString(),
                geminiTimeoutMs: parseInt($("ai-timeout-ms").value, 10) || 2800
            };
            await apiPut("/admin/ai/config", body);
            alert("Đã lưu cấu hình AI.");
            await loadConfig();
        } catch (e) {
            alert(e.message || "Không lưu được.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function refreshAll() {
        try {
            await loadMenuItems();
            await loadConfig();
            await loadStats();
            await loadRecent();
        } catch (e) {
            console.error(e);
            alert(e.message || "Không tải được dữ liệu AI (đăng nhập Admin).");
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        var save = $("ai-btn-save");
        if (save) save.addEventListener("click", saveConfig);
        var ref = $("ai-btn-refresh");
        if (ref) ref.addEventListener("click", refreshAll);
        var search = $("ai-menu-search");
        if (search) {
            search.addEventListener("input", function () {
                if (searchDebounce) clearTimeout(searchDebounce);
                searchDebounce = setTimeout(renderMenuPicker, 200);
            });
        }
        refreshAll();
    });
})();

/**
 * Quản lý đánh giá (ADMIN): danh sách, lọc, ẩn/hiện, xóa. Không có chức năng sửa nội dung khách.
 */
(function () {
    const API = (window.RESTAURANT_API_BASE || "http://localhost:8080/api").replace(/\/+$/, "");
    const token = () => localStorage.getItem("accessToken") || localStorage.getItem("token") || "";

    let _page = 0;
    let _size = 20;
    let _filterVisible = null;
    let _lastContent = [];
    let _lastTotal = 0;

    function el(id) {
        return document.getElementById(id);
    }

    function showAlert(msg, type) {
        const a = el("qldg-alert");
        if (!a) return;
        a.className = "alert mb-3 " + (type === "error" ? "alert-danger" : "alert-success");
        a.textContent = msg;
        a.classList.remove("d-none");
        if (type === "success") {
            setTimeout(function () {
                a.classList.add("d-none");
            }, 4000);
        }
    }

    function authHeaders() {
        return {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token()
        };
    }

    function fmtTime(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleString("vi-VN");
        } catch (e) {
            return String(iso);
        }
    }

    function esc(s) {
        const d = document.createElement("div");
        d.textContent = s == null ? "" : String(s);
        return d.innerHTML;
    }

    function starRow(n) {
        const c = Math.min(5, Math.max(0, Number(n) || 0));
        let h = '<span class="d-inline-flex text-warning align-middle gap-0">';
        for (let i = 1; i <= 5; i++) {
            h +=
                '<span class="material-symbols-outlined fs-6' +
                (i <= c ? " filled" : " text-secondary") +
                '">star</span>';
        }
        h += "</span>";
        return h;
    }

    async function load() {
        const list = el("qldg-list");
        const loadEl = el("qldg-loading");
        if (list) {
            list.innerHTML =
                '<div class="col-12 text-center text-secondary py-5" id="qldg-loading">Đang tải…</div>';
        }
        try {
            const params = new URLSearchParams();
            params.set("page", String(_page));
            params.set("size", String(_size));
            if (_filterVisible === true) params.set("isVisible", "true");
            if (_filterVisible === false) params.set("isVisible", "false");
            const res = await fetch(API + "/admin/reviews?" + params.toString(), { headers: authHeaders() });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Không tải được");
            }
            const page = json.data;
            const content = (page && page.content) || [];
            _lastContent = content;
            _lastTotal = (page && page.totalElements) || content.length;
            renderList(content);
            renderPagination(page);
        } catch (e) {
            if (list) {
                list.innerHTML =
                    '<div class="col-12"><div class="alert alert-danger rounded-4">' + esc(e.message) + "</div></div>";
            }
        }
    }

    function textMatch(r, q) {
        if (!q) return true;
        const u = (r.user && (r.user.fullName || r.user.username)) || "";
        const c = (r.comment || "") + "";
        const m = (r.menuItem && r.menuItem.name) || "";
        const blob = (u + " " + c + " " + m).toLowerCase();
        return blob.indexOf(q) >= 0;
    }

    function renderList(content) {
        const list = el("qldg-list");
        const q = (el("qldg-search") && el("qldg-search").value.trim().toLowerCase()) || "";
        const items = (content || []).filter(function (r) {
            return textMatch(r, q);
        });
        if (!items.length) {
            list.innerHTML =
                '<div class="col-12 text-center text-secondary py-4">Không có đánh giá phù hợp.</div>';
            return;
        }
        list.innerHTML = items
            .map(function (r) {
                const displayName = r.user
                    ? (r.user.fullName || r.user.username || "Khách hàng")
                    : r.guestName || "Khách tại bàn (QR)";
                const dish = (r.menuItem && r.menuItem.name) || "—";
                const vis = r.isVisible !== false;
                return (
                    '<div class="col-12 col-xl-6" data-rid="' +
                    r.id +
                    '">' +
                    '<div class="review-card p-4 rounded-4 shadow-sm border h-100">' +
                    '<div class="d-flex justify-content-between align-items-start mb-2 gap-2">' +
                    '<div class="d-flex align-items-center gap-3 min-w-0">' +
                    '<div class="rounded-circle bg-surface-dim d-flex align-items-center justify-content-center text-secondary flex-shrink-0" style="width:48px;height:48px;font-size:0.7rem;overflow:hidden">' +
                    (displayName || "K").charAt(0) +
                    "</div>" +
                    "<div class=\"min-w-0\">" +
                    "<h6 class=\"fw-bold mb-0 text-truncate\">" +
                    esc(displayName) +
                    "</h6>" +
                    '<p class="smaller text-secondary mb-0 text-truncate">' +
                    esc(fmtTime(r.createdAt)) +
                    " · " +
                    esc(dish) +
                    "</p>" +
                    "</div>" +
                    "</div>" +
                    '<div class="d-flex flex-column align-items-end gap-1 flex-shrink-0">' +
                    starRow(r.rating) +
                    (vis
                        ? '<span class="badge rounded-pill bg-success-subtle text-success smaller">Hiển thị</span>'
                        : '<span class="badge rounded-pill bg-secondary-subtle text-secondary smaller">Đã ẩn</span>') +
                    "</div>" +
                    "</div>" +
                    "<p class=\"small text-body mb-3\" style=\"white-space:pre-wrap;word-break:break-word\">" +
                    esc(r.comment || "") +
                    "</p>" +
                    '<div class="d-flex flex-wrap gap-2 border-top border-outline-variant/10 pt-3">' +
                    (vis
                        ? "<button type=\"button\" class=\"btn btn-sm btn-outline-warning rounded-pill qldg-hide\" data-id=\"" +
                          r.id +
                          '">Ẩn</button>'
                        : "<button type=\"button\" class=\"btn btn-sm btn-outline-success rounded-pill qldg-show\" data-id=\"" +
                          r.id +
                          '">Hiện lại</button>') +
                    "<button type=\"button\" class=\"btn btn-sm btn-outline-danger rounded-pill qldg-del\" data-id=\"" +
                    r.id +
                    '">Xóa vĩnh viễn</button></div></div></div></div>'
                );
            })
            .join("");

        list.querySelectorAll(".qldg-hide").forEach(function (b) {
            b.addEventListener("click", function () {
                setVis(parseInt(b.getAttribute("data-id"), 10), false);
            });
        });
        list.querySelectorAll(".qldg-show").forEach(function (b) {
            b.addEventListener("click", function () {
                setVis(parseInt(b.getAttribute("data-id"), 10), true);
            });
        });
        list.querySelectorAll(".qldg-del").forEach(function (b) {
            b.addEventListener("click", function () {
                del(parseInt(b.getAttribute("data-id"), 10));
            });
        });
    }

    async function setVis(id, isVisible) {
        try {
            const res = await fetch(API + "/admin/reviews/" + id + "/visibility?isVisible=" + isVisible, {
                method: "PATCH",
                headers: authHeaders()
            });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Thất bại");
            }
            showAlert(json.message || "Đã cập nhật", "success");
            load();
        } catch (e) {
            showAlert(e.message || "Lỗi", "error");
        }
    }

    async function del(id) {
        if (!confirm("Xóa vĩnh viễn đánh giá này? Hệ thống sẽ cập nhật điểm trung bình món (nếu có).")) return;
        try {
            const res = await fetch(API + "/admin/reviews/" + id, { method: "DELETE", headers: authHeaders() });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Thất bại");
            }
            showAlert(json.message || "Đã xóa", "success");
            load();
        } catch (e) {
            showAlert(e.message || "Lỗi", "error");
        }
    }

    function renderPagination(page) {
        const nav = el("qldg-pagination");
        if (!nav || !page) {
            if (nav) nav.innerHTML = "";
            return;
        }
        const total = page.totalPages || 0;
        if (total <= 1) {
            nav.innerHTML = "";
            return;
        }
        let h = '<ul class="pagination justify-content-center gap-1 mb-0">';
        h +=
            '<li class="page-item' +
            (page.first ? " disabled" : "") +
            '"><a class="page-link rounded-3" href="#" data-p="' +
            Math.max(0, _page - 1) +
            '">Trước</a></li>';
        for (let i = 0; i < total; i++) {
            if (i < _page - 2 || i > _page + 2) continue;
            h +=
                '<li class="page-item' +
                (i === _page ? " active" : "") +
                '"><a class="page-link rounded-3" href="#" data-p="' +
                i +
                '">' +
                (i + 1) +
                "</a></li>";
        }
        h +=
            '<li class="page-item' +
            (page.last ? " disabled" : "") +
            '"><a class="page-link rounded-3" href="#" data-p="' +
            Math.min(total - 1, _page + 1) +
            '">Sau</a></li></ul>';
        nav.innerHTML = h;
        nav.querySelectorAll("a[data-p]").forEach(function (a) {
            a.addEventListener("click", function (e) {
                e.preventDefault();
                if (a.parentElement.classList.contains("disabled")) return;
                _page = parseInt(a.getAttribute("data-p"), 10) || 0;
                load();
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!token()) {
            window.location.href = "../dangnhap.html?next=admin/qldanhgia.html";
            return;
        }
        document.querySelectorAll(".qldg-filter").forEach(function (btn) {
            btn.addEventListener("click", function () {
                document.querySelectorAll(".qldg-filter").forEach(function (b) {
                    b.classList.remove("btn-primary");
                    b.classList.add("btn-surface-high");
                });
                btn.classList.remove("btn-surface-high");
                btn.classList.add("btn-primary");
                const v = btn.getAttribute("data-vis");
                if (v === "") _filterVisible = null;
                else if (v === "true") _filterVisible = true;
                else _filterVisible = false;
                _page = 0;
                load();
            });
        });
        el("qldg-reload") &&
            el("qldg-reload").addEventListener("click", function () {
                load();
            });
        const se = el("qldg-search");
        if (se) {
            let t;
            se.addEventListener("input", function () {
                clearTimeout(t);
                t = setTimeout(function () {
                    renderList(_lastContent);
                }, 200);
            });
        }
        load();
    });
})();

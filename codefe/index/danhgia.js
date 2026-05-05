/* ================================================================
   danhgia.js — Đánh giá: xem công khai, gửi theo đơn đã thanh toán, sửa/xóa của tôi
   ================================================================ */
function _apiHost() {
    var h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" ? "localhost" : h;
}

function dgApiBase() {
    return (window.RESTAURANT_API_BASE || "http://" + _apiHost() + ":8080/api").replace(/\/+$/, "");
}

function dgToken() {
    return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
}

// ─── State ───────────────────────────────────────────────────────
var REVIEWS = [];
var _dgFilter = "all";
var _dgPageSize = 4;
var _dgHienTai = 4;
var _dgLiked = {};
var _dgEligible = [];
var _dgEditId = null;
/** true: khách vãng lai đang dùng mã QR bàn (không JWT) */
var _dgGuestMode = false;
var _dgEditIsGuest = false;

function dgQr() {
    try {
        return (typeof getActiveQrToken === "function" && getActiveQrToken()) || "";
    } catch (e) {
        return "";
    }
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
    if (typeof toastr !== "undefined") {
        toastr.options = {
            closeButton: true,
            progressBar: true,
            positionClass: "toast-top-right",
            timeOut: 4000
        };
    }
    dgCapNhatBadge();
    dgInitAuthPanel();
    dgFetchReviews();
});

function dgInitAuthPanel() {
    var gate = document.getElementById("dg-form-login-gate");
    var form = document.getElementById("dg-form-submit");
    var hint = document.getElementById("dg-guest-hint");
    var mineHint = document.getElementById("dg-mine-hint");
    var myList = document.getElementById("dg-my-list");
    var tok = dgToken();
    var qr = dgQr();
    _dgGuestMode = false;
    if (!gate || !form) return;

    var sel = document.getElementById("dg-sel-order");
    if (sel && !sel.dataset.dgBound) {
        sel.addEventListener("change", dgOnOrderChange);
        sel.dataset.dgBound = "1";
    }
    var saveBtn = document.getElementById("dg-edit-save");
    if (saveBtn && !saveBtn.dataset.dgBound) {
        saveBtn.addEventListener("click", dgEditSave);
        saveBtn.dataset.dgBound = "1";
    }

    if (tok) {
        gate.classList.add("d-none");
        form.classList.remove("d-none");
        if (mineHint) mineHint.classList.remove("d-none");
        if (hint) {
            hint.classList.remove("d-none");
            hint.innerHTML =
                'Chỉ áp dụng cho <strong>đơn hàng đã hoàn thành và đã thanh toán</strong>. Mỗi đơn chỉ đánh giá <strong>một lần</strong>.';
        }
        dgSetupStarButtons();
        dgLoadEligibleOrders();
        dgLoadMyReviews();
        return;
    }

    if (qr) {
        _dgGuestMode = true;
        gate.classList.add("d-none");
        form.classList.remove("d-none");
        if (mineHint) mineHint.classList.remove("d-none");
        if (hint) {
            hint.classList.remove("d-none");
            hint.innerHTML =
                "Bạn đang dùng <strong>menu tại bàn (QR)</strong>. Chỉ đánh giá được <strong>đơn của bàn này</strong> sau khi <strong>đã thanh toán</strong>. Mỗi đơn một lần.";
        }
        dgSetupStarButtons();
        dgLoadEligibleGuestOrders();
        dgLoadMyGuestReviews();
        return;
    }

    gate.classList.remove("d-none");
    form.classList.add("d-none");
    if (mineHint) mineHint.classList.add("d-none");
    if (hint) hint.classList.add("d-none");
    if (myList) {
        myList.innerHTML =
            '<p class="text-muted small mb-0">Đăng nhập (đơn có tài khoản) hoặc mở trang từ <strong>mã QR tại bàn</strong> (đơn vãng lai) để xem và gửi đánh giá.</p>';
    }
}

function dgSetupStarButtons() {
    var wrap = document.getElementById("dg-star-pick");
    var hidden = document.getElementById("dg-rating");
    if (!wrap || !hidden) return;
    var r0 = parseInt(hidden.value, 10) || 5;
    wrap.querySelectorAll(".dg-star-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var r = parseInt(btn.getAttribute("data-r"), 10);
            hidden.value = String(r);
            dgPaintStars(wrap, r);
        });
    });
    dgPaintStars(wrap, r0);
}

function dgPaintStars(container, rating) {
    if (!container) return;
    container.querySelectorAll(".dg-star-btn").forEach(function (btn) {
        var r = parseInt(btn.getAttribute("data-r"), 10);
        var icon = btn.querySelector("i");
        if (!icon) return;
        if (r <= rating) {
            icon.classList.remove("fa-regular");
            icon.classList.add("fa-solid");
        } else {
            icon.classList.remove("fa-solid");
            icon.classList.add("fa-regular");
        }
    });
}

function dgOnOrderChange() {
    var sel = document.getElementById("dg-sel-order");
    var dish = document.getElementById("dg-sel-dish");
    if (!sel || !dish) return;
    var id = sel.value;
    dish.innerHTML = '<option value="">-- Chọn món trong đơn --</option>';
    if (!id) return;
    var order = _dgEligible.find(function (o) {
        return String(o.orderId) === String(id);
    });
    if (!order || !order.lines) return;
    order.lines.forEach(function (line) {
        var opt = document.createElement("option");
        opt.value = line.menuItemId;
        opt.textContent = (line.menuItemName || "Món") + (line.quantity ? " ×" + line.quantity : "");
        dish.appendChild(opt);
    });
}

async function dgLoadEligibleOrders() {
    try {
        var res = await fetch(dgApiBase() + "/reviews/me/eligible-orders", {
            headers: { Authorization: "Bearer " + dgToken() }
        });
        var json = await res.json();
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Không tải được đơn hàng");
        }
        _dgEligible = Array.isArray(json.data) ? json.data : [];
        var sel = document.getElementById("dg-sel-order");
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Chọn đơn đủ điều kiện --</option>';
        _dgEligible.forEach(function (o) {
            var opt = document.createElement("option");
            opt.value = o.orderId;
            var paid = o.paidAt ? new Date(o.paidAt).toLocaleString("vi-VN") : "";
            opt.textContent = "Đơn #" + o.orderId + (o.tableInfo ? " · " + o.tableInfo : "") + (paid ? " · " + paid : "");
            sel.appendChild(opt);
        });
        if (_dgEligible.length === 0) {
            var opt0 = document.createElement("option");
            opt0.value = "";
            opt0.textContent = "— Không có đơn nào đủ điều kiện (hoàn tất + đã thanh toán, chưa đánh giá) —";
            sel.appendChild(opt0);
        }
    } catch (e) {
        console.warn(e);
    }
}

async function dgLoadEligibleGuestOrders() {
    var qr = dgQr();
    if (!qr) return;
    try {
        var res = await fetch(
            dgApiBase() + "/reviews/guest/eligible-orders?qrCodeToken=" + encodeURIComponent(qr),
            { headers: { "Content-Type": "application/json" } }
        );
        var json = await res.json();
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Không tải được đơn hàng");
        }
        _dgEligible = Array.isArray(json.data) ? json.data : [];
        var sel = document.getElementById("dg-sel-order");
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Chọn đơn đủ điều kiện --</option>';
        _dgEligible.forEach(function (o) {
            var opt = document.createElement("option");
            opt.value = o.orderId;
            var paid = o.paidAt ? new Date(o.paidAt).toLocaleString("vi-VN") : "";
            opt.textContent = "Đơn #" + o.orderId + (o.tableInfo ? " · " + o.tableInfo : "") + (paid ? " · " + paid : "");
            sel.appendChild(opt);
        });
        if (_dgEligible.length === 0) {
            var opt0 = document.createElement("option");
            opt0.value = "";
            opt0.textContent = "— Không có đơn nào đủ điều kiện (hoàn tất + đã thanh toán, chưa đánh giá) —";
            sel.appendChild(opt0);
        }
    } catch (e) {
        console.warn(e);
    }
}

async function dgLoadMyReviews() {
    var box = document.getElementById("dg-my-list");
    if (!box) return;
    if (!dgToken()) return;
    try {
        var res = await fetch(dgApiBase() + "/reviews/me", {
            headers: { Authorization: "Bearer " + dgToken() }
        });
        var json = await res.json();
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Lỗi");
        }
        var list = Array.isArray(json.data) ? json.data : [];
        if (list.length === 0) {
            box.innerHTML = '<p class="text-muted small mb-0">Bạn chưa có đánh giá nào.</p>';
            return;
        }
        box.innerHTML = "";
        list.forEach(function (r) {
            var name = (r.menuItem && r.menuItem.name) || "Món ăn";
            var t = r.comment || "";
            var st = dgRenderStars(r.rating);
            var div = document.createElement("div");
            div.className = "border rounded-3 p-3 mb-2 bg-light";
            div.innerHTML =
                '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">' +
                "<div><div class=\"fw-semibold\">" +
                dgEsc(name) +
                "</div><div class=\"dg-stars text-warning small\">" +
                st +
                "</div>" +
                '<p class="mb-0 mt-1 small text-break">' +
                dgEsc(t) +
                "</p></div>" +
                '<div class="btn-group btn-group-sm">' +
                "<button type=\"button\" class=\"btn btn-outline-secondary rounded-pill\" data-dg-edit=\"" +
                r.id +
                "\">Sửa</button>" +
                "<button type=\"button\" class=\"btn btn-outline-danger rounded-pill\" data-dg-del=\"" +
                r.id +
                "\">Xóa</button>" +
                "</div></div>";
            box.appendChild(div);
        });
        box.querySelectorAll("[data-dg-edit]").forEach(function (b) {
            b.addEventListener("click", function () {
                dgEditOpen(parseInt(b.getAttribute("data-dg-edit"), 10), list, false);
            });
        });
        box.querySelectorAll("[data-dg-del]").forEach(function (b) {
            b.addEventListener("click", function () {
                dgDeleteReview(parseInt(b.getAttribute("data-dg-del"), 10), false);
            });
        });
    } catch (e) {
        box.innerHTML = '<p class="text-danger small">Không tải được danh sách đánh giá của bạn.</p>';
    }
}

async function dgLoadMyGuestReviews() {
    var box = document.getElementById("dg-my-list");
    if (!box) return;
    var qr = dgQr();
    if (!qr) return;
    try {
        var res = await fetch(
            dgApiBase() + "/reviews/guest/mine?qrCodeToken=" + encodeURIComponent(qr),
            { headers: { "Content-Type": "application/json" } }
        );
        var json = await res.json();
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Lỗi");
        }
        var list = Array.isArray(json.data) ? json.data : [];
        if (list.length === 0) {
            box.innerHTML = '<p class="text-muted small mb-0">Chưa có đánh giá nào từ bàn này (mã QR hiện tại).</p>';
            return;
        }
        box.innerHTML = "";
        list.forEach(function (r) {
            var name = (r.menuItem && r.menuItem.name) || "Món ăn";
            var t = r.comment || "";
            var st = dgRenderStars(r.rating);
            var div = document.createElement("div");
            div.className = "border rounded-3 p-3 mb-2 bg-light";
            div.innerHTML =
                '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">' +
                "<div><div class=\"fw-semibold\">" +
                dgEsc(name) +
                "</div><div class=\"dg-stars text-warning small\">" +
                st +
                "</div>" +
                '<p class="mb-0 mt-1 small text-break">' +
                dgEsc(t) +
                "</p></div>" +
                '<div class="btn-group btn-group-sm">' +
                "<button type=\"button\" class=\"btn btn-outline-secondary rounded-pill\" data-dg-gedit=\"" +
                r.id +
                "\">Sửa</button>" +
                "<button type=\"button\" class=\"btn btn-outline-danger rounded-pill\" data-dg-gdel=\"" +
                r.id +
                "\">Xóa</button>" +
                "</div></div>";
            box.appendChild(div);
        });
        box.querySelectorAll("[data-dg-gedit]").forEach(function (b) {
            b.addEventListener("click", function () {
                dgEditOpen(parseInt(b.getAttribute("data-dg-gedit"), 10), list, true);
            });
        });
        box.querySelectorAll("[data-dg-gdel]").forEach(function (b) {
            b.addEventListener("click", function () {
                dgDeleteReview(parseInt(b.getAttribute("data-dg-gdel"), 10), true);
            });
        });
    } catch (e) {
        box.innerHTML = '<p class="text-danger small">Không tải được đánh giá tại bàn.</p>';
    }
}

function dgEsc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function dgEditOpen(id, list, isGuest) {
    _dgEditIsGuest = !!isGuest;
    var r = (list || []).find(function (x) {
        return x.id === id;
    });
    if (!r) return;
    _dgEditId = id;
    var dish = document.getElementById("dg-edit-dish");
    var ta = document.getElementById("dg-edit-comment");
    var h = document.getElementById("dg-edit-rating");
    var w = document.getElementById("dg-edit-star-pick");
    if (dish) dish.textContent = (r.menuItem && r.menuItem.name) || "Món ăn";
    if (ta) ta.value = r.comment || "";
    if (h) h.value = String(r.rating || 5);
    if (w) {
        w.innerHTML = "";
        for (var i = 1; i <= 5; i++) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "btn btn-link p-0";
            b.setAttribute("data-r", String(i));
            b.innerHTML = '<i class="fa-lg text-warning ' + (i <= (r.rating || 5) ? "fa-solid" : "fa-regular") + ' fa-star"></i>';
            b.addEventListener("click", function () {
                var rr = parseInt(this.getAttribute("data-r"), 10);
                h.value = String(rr);
                w.querySelectorAll("button").forEach(function (btn, idx) {
                    var starR = idx + 1;
                    var ic = btn.querySelector("i");
                    if (ic) {
                        ic.className = "fa-lg text-warning fa-star " + (starR <= rr ? "fa-solid" : "fa-regular");
                    }
                });
            });
            w.appendChild(b);
        }
    }
    var modal = document.getElementById("dg-edit-modal");
    if (modal && typeof bootstrap !== "undefined") {
        new bootstrap.Modal(modal).show();
    }
}

async function dgEditSave() {
    if (!_dgEditId) return;
    var ta = document.getElementById("dg-edit-comment");
    var h = document.getElementById("dg-edit-rating");
    if (!ta || !h) return;
    var body = {
        rating: parseInt(h.value, 10),
        comment: (ta.value || "").trim()
    };
    if (body.rating < 1 || body.rating > 5 || !body.comment) {
        toastr.warning("Vui lòng chọn số sao và nhập nội dung hợp lệ.");
        return;
    }
    try {
        var url = _dgEditIsGuest
            ? dgApiBase() + "/reviews/guest/" + _dgEditId + "?qrCodeToken=" + encodeURIComponent(dgQr())
            : dgApiBase() + "/reviews/" + _dgEditId;
        var headers = { "Content-Type": "application/json" };
        if (!_dgEditIsGuest) {
            headers["Authorization"] = "Bearer " + dgToken();
        }
        var res = await fetch(url, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(body)
        });
        var json = await res.json();
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Không cập nhật được");
        }
        toastr.success(json.message || "Đã cập nhật đánh giá");
        var m = document.getElementById("dg-edit-modal");
        if (m && typeof bootstrap !== "undefined") {
            var inst = bootstrap.Modal.getInstance(m);
            if (inst) inst.hide();
        }
        if (_dgEditIsGuest) {
            dgLoadMyGuestReviews();
            dgLoadEligibleGuestOrders();
        } else {
            dgLoadMyReviews();
            dgLoadEligibleOrders();
        }
        dgFetchReviews();
    } catch (e) {
        toastr.error(e.message || "Lỗi");
    }
}

async function dgDeleteReview(id, isGuest) {
    if (!confirm("Xóa đánh giá này? Thao tác không hoàn tác với bản lưu trên hệ thống khách.")) return;
    try {
        var url = isGuest
            ? dgApiBase() + "/reviews/guest/" + id + "?qrCodeToken=" + encodeURIComponent(dgQr())
            : dgApiBase() + "/reviews/" + id;
        var res = await fetch(url, {
            method: "DELETE",
            headers: isGuest ? {} : { Authorization: "Bearer " + dgToken() }
        });
        var json = await res.json();
        if (!res.ok || json.success === false) {
            throw new Error(json.message || "Không xóa được");
        }
        toastr.success(json.message || "Đã xóa đánh giá");
        if (isGuest) {
            dgLoadMyGuestReviews();
            dgLoadEligibleGuestOrders();
        } else {
            dgLoadMyReviews();
            dgLoadEligibleOrders();
        }
        dgFetchReviews();
    } catch (e) {
        toastr.error(e.message || "Lỗi");
    }
}

function dgOnSubmit(e) {
    e.preventDefault();
    var o = document.getElementById("dg-sel-order");
    var d = document.getElementById("dg-sel-dish");
    var h = document.getElementById("dg-rating");
    var c = document.getElementById("dg-comment");
    if (!o || !d || !h || !c) return false;
    var orderId = o.value;
    var menuItemId = d.value;
    var payload = {
        orderId: parseInt(orderId, 10),
        menuItemId: parseInt(menuItemId, 10),
        rating: parseInt(h.value, 10),
        comment: (c.value || "").trim()
    };
    if (!orderId || !menuItemId || payload.rating < 1 || !payload.comment) {
        toastr.warning("Vui lòng chọn đơn, món, số sao và nhập nội dung.");
        return false;
    }
    var btn = document.getElementById("dg-btn-send");
    if (btn) btn.disabled = true;
    fetch(dgApiBase() + "/reviews", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + dgToken()
        },
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            return res.json().then(function (j) {
                return { res: res, j: j };
            });
        })
        .then(function (_a) {
            var res = _a.res;
            var json = _a.j;
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Gửi thất bại");
            }
            toastr.success(json.message || "Đánh giá thành công");
            c.value = "";
            if (isGuest) {
                dgLoadEligibleGuestOrders();
                dgLoadMyGuestReviews();
            } else {
                dgLoadEligibleOrders();
                dgLoadMyReviews();
            }
            document.getElementById("dg-sel-dish").innerHTML = '<option value="">-- Chọn món trong đơn --</option>';
            dgFetchReviews();
        })
        .catch(function (err) {
            toastr.error(err.message || "Lỗi gửi đánh giá");
        })
        .finally(function () {
            if (btn) btn.disabled = false;
        });
    return false;
}

// ─── Fetch Reviews from API (công khai) ───────────────────────────
function dgFetchReviews() {
    var container = document.getElementById("dg-review-list");
    if (container) {
        container.innerHTML =
            '<div class="text-center py-5">' +
            '<i class="fa-solid fa-spinner fa-spin fa-2x text-muted"></i>' +
            '<p class="text-muted mt-2">Đang tải đánh giá...</p>' +
            "</div>";
    }

    var token = localStorage.getItem("accessToken");
    var headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;

    fetch(dgApiBase() + "/reviews?size=200", { headers: headers })
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (json) {
            var items = [];
            if (Array.isArray(json)) {
                items = json;
            } else if (json && Array.isArray(json.data)) {
                items = json.data;
            } else if (json && json.data && Array.isArray(json.data.content)) {
                items = json.data.content;
            }

            REVIEWS = items.map(function (r) {
                return {
                    id: r.id,
                    name: (r.user && (r.user.fullName || r.user.username)) || r.guestName || r.userName || "Khách hàng",
                    avatar: (r.user && r.user.avatar) || r.userAvatar || "https://i.pravatar.cc/100?u=" + r.id,
                    rating: r.rating || r.star || 5,
                    time: dgFormatTime(r.createdAt || r.reviewDate),
                    food: (r.menuItem && r.menuItem.name) || r.menuItemName || "",
                    text: r.comment || r.content || r.text || "",
                    images: r.images || r.reviewImages || [],
                    likes: r.likeCount || r.likes || 0
                };
            });

            dgCapNhatSummary();
            _dgHienTai = _dgPageSize;
            dgRender();
        })
        .catch(function (err) {
            console.error("Lỗi tải đánh giá:", err);
            REVIEWS = [];
            dgCapNhatSummary();
            dgRender();
        });
}

// ─── Format time helper ──────────────────────────────────────────
function dgFormatTime(dateStr) {
    if (!dateStr) return "";
    try {
        var d = new Date(dateStr);
        var now = new Date();
        var diff = Math.floor((now - d) / 1000);
        if (diff < 3600) return Math.floor(diff / 60) + " phút trước";
        if (diff < 86400) return Math.floor(diff / 3600) + " giờ trước";
        if (diff < 604800) return Math.floor(diff / 86400) + " ngày trước";
        return d.toLocaleDateString("vi-VN");
    } catch (e) {
        return dateStr;
    }
}

// ─── Summary Stats ───────────────────────────────────────────────
function dgCapNhatSummary() {
    var total = REVIEWS.length;

    if (total === 0) {
        var scoreEl = document.getElementById("dg-avg-score");
        if (scoreEl) scoreEl.textContent = "0";
        var starsEl = document.getElementById("dg-avg-stars");
        if (starsEl) starsEl.innerHTML = dgRenderStars(0);
        var totalEl = document.getElementById("dg-total-text");
        if (totalEl) totalEl.innerHTML = "Chưa có đánh giá nào";
        for (var s = 5; s >= 1; s--) {
            var bar = document.getElementById("bar-" + s);
            var pctEl = document.getElementById("pct-" + s);
            if (bar) bar.style.width = "0%";
            if (pctEl) pctEl.textContent = "0%";
        }
        return;
    }

    var counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    var sum = 0;
    REVIEWS.forEach(function (r) {
        counts[r.rating] = (counts[r.rating] || 0) + 1;
        sum += r.rating;
    });
    var avg = (sum / total).toFixed(1);

    var scoreEl2 = document.getElementById("dg-avg-score");
    if (scoreEl2) scoreEl2.textContent = avg;

    var starsEl2 = document.getElementById("dg-avg-stars");
    if (starsEl2) starsEl2.innerHTML = dgRenderStars(parseFloat(avg));

    var totalEl2 = document.getElementById("dg-total-text");
    if (totalEl2) totalEl2.innerHTML = "Dựa trên <strong>" + total.toLocaleString("vi-VN") + "</strong> đánh giá thực tế";

    for (var i = 5; i >= 1; i--) {
        var pct = Math.round((counts[i] / total) * 100);
        var barEl = document.getElementById("bar-" + i);
        var pctEl2 = document.getElementById("pct-" + i);
        if (barEl) barEl.style.width = pct + "%";
        if (pctEl2) pctEl2.textContent = pct + "%";
    }
}
// ─── Filter ──────────────────────────────────────────────────────
function dgFilter(el) {
    _dgFilter = el.getAttribute("data-filter");

    document.querySelectorAll(".dg-filter-btn").forEach(function (b) {
        b.classList.remove("active");
    });
    el.classList.add("active");

    _dgHienTai = _dgPageSize;
    dgRender();
}

function dgGetFiltered() {
    var list = REVIEWS.slice();

    if (_dgFilter === "5") {
        list = list.filter(function (r) {
            return r.rating === 5;
        });
    } else if (_dgFilter === "4") {
        list = list.filter(function (r) {
            return r.rating === 4;
        });
    } else if (_dgFilter === "hasImg") {
        list = list.filter(function (r) {
            return r.images && r.images.length > 0;
        });
    } else if (_dgFilter === "newest") {
        list = list.slice().reverse();
    }

    return list;
}

// ─── Render Reviews ──────────────────────────────────────────────
function dgRender() {
    var container = document.getElementById("dg-review-list");
    if (!container) return;

    var filtered = dgGetFiltered();

    if (filtered.length === 0) {
        container.innerHTML =
            '<div class="text-center py-5">' +
            '<i class="fa-solid fa-comment-slash fa-3x text-muted mb-3 d-block"></i>' +
            '<p class="text-muted">Chưa có đánh giá nào cho bộ lọc này.</p>' +
            "</div>";
        _dgCapNhatNut(0, 0);
        return;
    }

    var hien = filtered.slice(0, _dgHienTai);

    container.innerHTML = hien
        .map(function (r) {
            var stars = dgRenderStars(r.rating);
            var imgHtml = "";
            if (r.images && r.images.length > 0) {
                imgHtml =
                    '<div class="dg-review-imgs">' +
                    r.images
                        .map(function (src) {
                            return (
                                '<img src="' + src + '" alt="Ảnh đánh giá" loading="lazy" onerror="this.style.display=\'none\'">'
                            );
                        })
                        .join("") +
                    "</div>";
            }

            var isLiked = _dgLiked[r.id];
            var likeCount = r.likes + (isLiked ? 1 : 0);

            return (
                '<div class="dg-review-card">' +
                '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">' +
                '<div class="dg-reviewer">' +
                '<img class="dg-avatar" src="' + r.avatar + '" alt="" onerror="this.src=\'https://i.pravatar.cc/100\'">' +
                "<div>" +
                '<div class="dg-name">' +
                (r.name + "").replace(/</g, "&lt;") +
                "</div>" +
                '<div class="dg-meta">' +
                '<span class="dg-stars">' + stars + "</span>" +
                "<span>• " + (r.time + "").replace(/</g, "&lt;") + "</span>" +
                "</div>" +
                "</div>" +
                "</div>" +
                '<span class="dg-food-badge">' +
                (r.food + "").replace(/</g, "&lt;") +
                "</span>" +
                "</div>" +
                '<p class="dg-review-text">' +
                (r.text + "")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;") +
                "</p>" +
                imgHtml +
                '<div class="dg-actions">' +
                '<button class="dg-action-btn ' + (isLiked ? "liked" : "") + '" type="button" onclick="dgLike(' + r.id + ")'>" +
                '<i class="fa-solid fa-thumbs-up"></i> Hữu ích (' + likeCount + ")</button>" +
                '<button class="dg-action-btn" type="button" onclick="dgReport(' + r.id + ')">' +
                '<i class="fa-solid fa-flag"></i> Báo cáo</button>' +
                "</div>" +
                "</div>"
            );
        })
        .join("");

    _dgCapNhatNut(hien.length, filtered.length);
}

// ─── Xem thêm ───────────────────────────────────────────────────
function _dgCapNhatNut(hien, total) {
    var btn = document.getElementById("btn-xem-them-dg");
    if (!btn) return;
    if (hien >= total) {
        btn.style.display = "none";
    } else {
        btn.style.display = "inline-block";
        btn.textContent = "Xem thêm " + (total - hien).toLocaleString("vi-VN") + " đánh giá";
    }
}

function dgXemThem() {
    _dgHienTai += _dgPageSize;
    dgRender();
}

// ─── Like / Report ───────────────────────────────────────────────
function dgLike(id) {
    _dgLiked[id] = !_dgLiked[id];
    dgRender();
}

function dgReport(id) {
    alert("Cảm ơn bạn đã báo cáo. Nhà hàng sẽ kiểm duyệt theo nội quy (quản trị viên có thể ẩn/xóa nội dung vi phạm). Đánh giá #" + id + ".");
}

// ─── Stars Helper ────────────────────────────────────────────────
function dgRenderStars(rating) {
    var full = Math.floor(rating);
    var half = rating % 1 >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    var s = "";
    for (var i = 0; i < full; i++) s += '<i class="fa-solid fa-star"></i>';
    if (half) s += '<i class="fa-solid fa-star-half-stroke"></i>';
    for (var j = 0; j < empty; j++) s += '<i class="fa-regular fa-star"></i>';
    return s;
}

// ─── Cart Badge (chỉ khi quét QR bàn) ─────────────────────────────
function dgCapNhatBadge() {
    var badge = document.getElementById("cart-badge");
    if (!badge) return;
    if (typeof getActiveQrToken === "function" && !getActiveQrToken()) {
        badge.textContent = "0";
        badge.style.display = "none";
        return;
    }
    try {
        var cart = typeof layGioHangChung === "function" ? layGioHangChung() : [];
        var tong = cart.reduce(function (s, x) {
            return s + (x.soLuong || 1);
        }, 0);
        badge.textContent = tong > 99 ? "99+" : tong;
        badge.style.display = tong > 0 ? "inline-block" : "none";
    } catch (e) {}
}

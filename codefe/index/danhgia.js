/* ================================================================
   danhgia.js — Đánh giá: xem công khai, gửi theo đơn đã thanh toán, sửa/xóa của tôi
   ================================================================ */
function dgApiBase() {
    return (window.API_BASE || "").replace(/\/+$/, "");
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

function dgParseDate(val) {
    if (!val) return null;
    // Java LocalDateTime array: [year, month, day, hour, min, sec] (month is 1-based)
    if (Array.isArray(val) && val.length >= 3) {
        return new Date(val[0], val[1] - 1, val[2], val[3] || 0, val[4] || 0, val[5] || 0);
    }
    var d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
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
            var paidD = dgParseApiDateTime(o.paidAt);
            var paid = paidD ? paidD.toLocaleString("vi-VN") : "";
            opt.textContent = "Đơn #" + o.orderId + (o.tableInfo ? " · " + o.tableInfo : "") + (paid ? " · " + paid : "");
            sel.appendChild(opt);
        });
        if (_dgEligible.length === 0) {
           
            if (dgQr()) {
                _dgGuestMode = true;
                dgLoadEligibleGuestOrders();
                dgLoadMyGuestReviews();
                return;
            }
            var opt0 = document.createElement("option");
            opt0.value = "";
            opt0.textContent = "— Không có đơn nào đủ điều kiện (hoàn tất + đã thanh toán, chưa đánh giá) —";
            sel.appendChild(opt0);
        }
    } catch (e) {
        console.error("dgLoadEligibleOrders error:", e);
      
        if (dgQr()) {
            _dgGuestMode = true;
            dgLoadEligibleGuestOrders();
            dgLoadMyGuestReviews();
            return;
        }
        var sel2 = document.getElementById("dg-sel-order");
        if (sel2) {
            sel2.innerHTML = '<option value="">' + (e.message || "Lỗi tải đơn hàng") + '</option>';
        }
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
            var paidD = dgParseApiDateTime(o.paidAt);
            var paid = paidD ? paidD.toLocaleString("vi-VN") : "";
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
        console.error("dgLoadEligibleGuestOrders error:", e);
        var selErr = document.getElementById("dg-sel-order");
        if (selErr) {
            selErr.innerHTML = '<option value="">' + (e.message || "Lỗi tải đơn hàng") + '</option>';
        }
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
        if (!res.ok) {
            // 500 = lỗi server, hiện trống thay vì báo lỗi
            if (res.status >= 500) {
                box.innerHTML = '<p class="text-muted small mb-0">Bạn chưa có đánh giá nào.</p>';
                return;
            }
            throw new Error((json && json.message) || "Lỗi");
        }
        if (json.success === false) throw new Error(json.message || "Lỗi");
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
        console.error("dgLoadMyReviews error:", e);
        box.innerHTML = '<p class="text-danger small">Không tải được danh sách đánh giá của bạn: ' + dgEsc(e.message || "") + '</p>';
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

function dgNotify(msg, type) {
    var text = msg || (type === "error" ? "Có lỗi xảy ra." : "Đánh giá thành công!");
    var box = document.getElementById("dg-submit-feedback");
    if (box) {
        box.className =
            "alert mt-3 mb-0 alert-" + (type === "error" ? "danger" : "success");
        box.innerHTML =
            '<i class="fa-solid ' +
            (type === "error" ? "fa-circle-xmark" : "fa-circle-check") +
            ' me-2"></i>' +
            dgEsc(text);
        box.classList.remove("d-none");
        try {
            box.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (e0) {}
        if (type !== "error") {
            window.setTimeout(function () {
                box.classList.add("d-none");
            }, 8000);
        }
    }
    if (typeof toastr !== "undefined") {
        if (type === "error") toastr.error(text);
        else toastr.success(text);
    } else if (type === "error") {
        window.alert(text);
    }
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
        dgNotify("Vui lòng chọn số sao và nhập nội dung hợp lệ.", "error");
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
        dgNotify(json.message || "Đã cập nhật đánh giá.", "success");
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
        dgNotify(e.message || "Lỗi", "error");
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
        dgNotify(json.message || "Đã xóa đánh giá.", "success");
        if (isGuest) {
            dgLoadMyGuestReviews();
            dgLoadEligibleGuestOrders();
        } else {
            dgLoadMyReviews();
            dgLoadEligibleOrders();
        }
        dgFetchReviews();
    } catch (e) {
        dgNotify(e.message || "Lỗi", "error");
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
        dgNotify("Vui lòng chọn đơn, món, số sao và nhập nội dung.", "error");
        return false;
    }
    var btn = document.getElementById("dg-btn-send");
    if (btn) btn.disabled = true;

    var guest = _dgGuestMode === true;
    var url = guest ? dgApiBase() + "/reviews/guest" : dgApiBase() + "/reviews";
    var headers = { "Content-Type": "application/json" };
    if (!guest) {
        headers["Authorization"] = "Bearer " + dgToken();
    }
    var body = {
        orderId: payload.orderId,
        menuItemId: payload.menuItemId,
        rating: payload.rating,
        comment: payload.comment
    };
    if (guest) {
        var qt = dgQr();
        if (!qt) {
            dgNotify("Thiếu mã bàn (QR). Mở lại trang từ mã QR tại bàn.", "error");
            if (btn) btn.disabled = false;
            return false;
        }
        body.qrCodeToken = qt;
    }

    fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
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
            var okMsg = json.message || "Đánh giá thành công! Cảm ơn bạn đã chia sẻ.";
            dgNotify(okMsg, "success");
            c.value = "";
            if (guest) {
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
            dgNotify(err.message || "Lỗi gửi đánh giá", "error");
            // Nếu đã đánh giá rồi, reload danh sách để hiện đánh giá cũ cho user xem/xóa
            if (err.message && err.message.indexOf("đánh giá") !== -1) {
                if (_dgGuestMode) dgLoadMyGuestReviews();
                else dgLoadMyReviews();
            }
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

// ─── Parse API date (ISO, Jackson LocalDateTime array [y,m,d,h,mi,s], v.v.) ──
function dgParseApiDateTime(v) {
    if (v == null || v === "") return null;
    try {
        if (typeof v === "string") {
            var s = v.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/, "$1T$2");
            var d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof v === "number") {
            var dn = new Date(v);
            return isNaN(dn.getTime()) ? null : dn;
        }
        if (Array.isArray(v) && v.length >= 3) {
            var y = v[0];
            var mo = (v[1] || 1) - 1;
            var day = v[2] || 1;
            var h = v[3] != null ? v[3] : 0;
            var mi = v[4] != null ? v[4] : 0;
            var sec = v[5] != null ? v[5] : 0;
            var ms = 0;
            if (v.length > 6 && v[6] != null) {
                ms = Math.floor(Number(v[6]) / 1000000);
            }
            var da = new Date(y, mo, day, h, mi, sec, ms);
            return isNaN(da.getTime()) ? null : da;
        }
        if (typeof v === "object" && v.year != null) {
            var month = v.monthValue != null ? v.monthValue : typeof v.month === "number" ? v.month : 1;
            var dob = new Date(
                v.year,
                month - 1,
                v.dayOfMonth || v.day || 1,
                v.hour || 0,
                v.minute || 0,
                v.second || 0
            );
            return isNaN(dob.getTime()) ? null : dob;
        }
    } catch (e) {
        /* ignore */
    }
    return null;
}

// ─── Format time helper ──────────────────────────────────────────
function dgFormatTime(dateStr) {
    var d = dgParseApiDateTime(dateStr);
    if (!d) return "";
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 0) return d.toLocaleString("vi-VN");
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return Math.floor(diff / 60) + " phút trước";
    if (diff < 86400) return Math.floor(diff / 3600) + " giờ trước";
    if (diff < 604800) return Math.floor(diff / 86400) + " ngày trước";
    return d.toLocaleDateString("vi-VN");
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

// Expose handler inline (onclick / onsubmit) cho HTML.
window.dgOnSubmit = dgOnSubmit;
window.dgFilter = dgFilter;
window.dgXemThem = dgXemThem;

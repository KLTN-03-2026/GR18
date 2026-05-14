/**
 * Đánh giá khách QR — mở từ qr-menu.html, không chuyển trang sang danhgia.html.
 */
(function () {
    var _qrRevEligible = [];
    var _qrRevModal;

    function apiBase() {
        return (window.API_BASE || "").replace(/\/+$/, "");
    }

    function qrTok() {
        try {
            return typeof getActiveQrToken === "function" ? getActiveQrToken() || "" : "";
        } catch (e) {
            return "";
        }
    }

    function parseApiDateTime(v) {
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
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    function toast(msg, isError) {
        var body = document.getElementById("qr-review-toast-body");
        var el = document.getElementById("qr-review-toast");
        if (!body || !el || typeof bootstrap === "undefined") {
            window.alert(msg);
            return;
        }
        body.textContent = msg;
        el.classList.remove("text-bg-dark", "text-bg-danger", "text-bg-success");
        el.classList.add(isError ? "text-bg-danger" : "text-bg-success");
        bootstrap.Toast.getOrCreateInstance(el, { delay: isError ? 4500 : 2800 }).show();
    }

    function paintStars(wrap, rating) {
        if (!wrap) return;
        wrap.querySelectorAll(".qr-rev-star").forEach(function (btn) {
            var r = parseInt(btn.getAttribute("data-r"), 10);
            var icon = btn.querySelector("i");
            if (!icon) return;
            icon.classList.remove("fa-solid", "fa-regular");
            icon.classList.add(r <= rating ? "fa-solid" : "fa-regular");
        });
    }

    function setupStarRow() {
        var wrap = document.getElementById("qr-rev-star-pick");
        var hidden = document.getElementById("qr-rev-rating");
        if (!wrap || !hidden) return;
        if (!wrap.dataset.qrRevBound) {
            wrap.querySelectorAll(".qr-rev-star").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var r = parseInt(btn.getAttribute("data-r"), 10);
                    hidden.value = String(r);
                    paintStars(wrap, r);
                });
            });
            wrap.dataset.qrRevBound = "1";
        }
        hidden.value = "5";
        paintStars(wrap, 5);
    }

    function onOrderChange() {
        var sel = document.getElementById("qr-rev-sel-order");
        var dish = document.getElementById("qr-rev-sel-dish");
        if (!sel || !dish) return;
        var id = sel.value;
        dish.innerHTML = '<option value="">-- Chọn món trong đơn --</option>';
        if (!id) return;
        var order = _qrRevEligible.find(function (o) {
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

    async function loadEligible() {
        var sel = document.getElementById("qr-rev-sel-order");
        var dish = document.getElementById("qr-rev-sel-dish");
        if (!sel) return;
        var t = qrTok();
        if (!t) {
            sel.innerHTML = '<option value="">— Thiếu mã bàn —</option>';
            return;
        }
        try {
            var res = await fetch(
                apiBase() + "/reviews/guest/eligible-orders?qrCodeToken=" + encodeURIComponent(t)
            );
            var json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Không tải đơn");
            }
            _qrRevEligible = Array.isArray(json.data) ? json.data : [];
            sel.innerHTML = '<option value="">-- Chọn đơn đủ điều kiện --</option>';
            _qrRevEligible.forEach(function (o) {
                var opt = document.createElement("option");
                opt.value = o.orderId;
                var paidD = parseApiDateTime(o.paidAt);
                var paid = paidD ? paidD.toLocaleString("vi-VN") : "";
                opt.textContent =
                    "Đơn #" + o.orderId + (o.tableInfo ? " · " + o.tableInfo : "") + (paid ? " · " + paid : "");
                sel.appendChild(opt);
            });
            if (_qrRevEligible.length === 0) {
                var z = document.createElement("option");
                z.value = "";
                z.textContent = "— Chưa có đơn hoàn thành & đã thanh toán để đánh giá —";
                sel.appendChild(z);
            }
        } catch (e) {
            console.warn(e);
            sel.innerHTML = '<option value="">— Không tải được đơn —</option>';
        }
        if (dish) dish.innerHTML = '<option value="">-- Chọn món trong đơn --</option>';
        onOrderChange();
    }

    async function onSubmit(ev) {
        ev.preventDefault();
        var t = qrTok();
        if (!t) {
            toast("Thiếu mã QR bàn. Quét lại QR tại bàn.", true);
            return false;
        }
        var o = document.getElementById("qr-rev-sel-order");
        var d = document.getElementById("qr-rev-sel-dish");
        var h = document.getElementById("qr-rev-rating");
        var c = document.getElementById("qr-rev-comment");
        if (!o || !d || !h || !c) return false;
        var payload = {
            orderId: parseInt(o.value, 10),
            menuItemId: parseInt(d.value, 10),
            rating: parseInt(h.value, 10),
            comment: (c.value || "").trim(),
            qrCodeToken: t
        };
        if (!o.value || !d.value || payload.rating < 1 || !payload.comment) {
            toast("Chọn đơn, món, sao và nhập nhận xét.", true);
            return false;
        }
        var btn = document.getElementById("qr-rev-send");
        if (btn) btn.disabled = true;
        try {
            var res = await fetch(apiBase() + "/reviews/guest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            var json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Gửi thất bại");
            }
            toast(json.message || "Đánh giá thành công!", false);
            c.value = "";
            if (d) d.innerHTML = '<option value="">-- Chọn món trong đơn --</option>';
            await loadEligible();
        } catch (e) {
            toast(e.message || "Lỗi gửi đánh giá", true);
        } finally {
            if (btn) btn.disabled = false;
        }
        return false;
    }

    function openModal() {
        if (!qrTok()) {
            toast("Vui lòng quét mã QR tại bàn trước.", true);
            return;
        }
        if (!_qrRevModal || typeof bootstrap === "undefined") return;
        _qrRevModal.show();
        setupStarRow();
        var sel = document.getElementById("qr-rev-sel-order");
        if (sel && !sel.dataset.qrRevBound) {
            sel.addEventListener("change", onOrderChange);
            sel.dataset.qrRevBound = "1";
        }
        loadEligible();
    }

    function bind() {
        var btn = document.getElementById("btn-qr-rate");
        var modalEl = document.getElementById("qr-review-modal");
        var form = document.getElementById("qr-review-form");
        if (!modalEl || typeof bootstrap === "undefined") return;
        _qrRevModal = new bootstrap.Modal(modalEl);
        if (btn) {
            btn.addEventListener("click", openModal);
        }
        if (form) {
            form.addEventListener("submit", onSubmit);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind);
    } else {
        bind();
    }
})();

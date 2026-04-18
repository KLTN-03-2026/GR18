/**
 * Giỏ hàng + gửi đơn khách vãng lai (POST /orders/guest).
 * Cần mã QR hợp lệ trong session (mở menu với ?t=...).
 */
(function () {
    var API_BASE = window.RESTAURANT_API_BASE || "http://localhost:8080/api";
    var DEMO_ORDERS_KEY = "guestDemoOrders";
    var DEMO_CALLS_KEY = "guestDemoCalls";
    var LAST_GUEST_NAME_KEY = "guestLastName";
    var isSubmittingOrder = false;

    function $(id) {
        return document.getElementById(id);
    }

    function formatVND(n) {
        return Number(n).toLocaleString("vi-VN") + " đ";
    }

    function renderCart() {
        var body = $("cart-body");
        var summaryEl = $("cart-summary-text");
        var clearBtn = $("btn-clear-cart");
        var token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
        if (!body) return;

        if (!token) {
            body.innerHTML =
                '<p class="text-warning mb-0"><i class="fa-solid fa-qrcode me-2"></i>Chưa có mã bàn. Vui lòng quét QR hoặc mở ' +
                '<a href="menu.html">menu</a> từ link có tham số <code>t</code>.</p>';
            $("btn-submit-order")?.setAttribute("disabled", "disabled");
            if (summaryEl) summaryEl.textContent = "0 món • Tổng 0 đ";
            if (clearBtn) clearBtn.classList.add("d-none");
            return;
        }

        var cart = typeof layGioHangChung === "function" ? layGioHangChung() : [];
        if (!cart.length) {
            body.innerHTML =
                '<p class="text-muted mb-0">Giỏ hàng trống. <a href="menu.html?t=' +
                encodeURIComponent(token) +
                '">Quay lại thực đơn</a></p>';
            $("btn-submit-order")?.setAttribute("disabled", "disabled");
            if (summaryEl) summaryEl.textContent = "0 món • Tổng 0 đ";
            if (clearBtn) clearBtn.classList.add("d-none");
            return;
        }

        $("btn-submit-order")?.removeAttribute("disabled");

        var total = 0;
        var rows = cart
            .map(function (item, idx) {
                var sl = Number(item.soLuong) || 1;
                var gia = Number(item.gia) || 0;
                total += gia * sl;
                var gc = item.ghiChu ? '<div class="small text-muted">' + escapeHtml(item.ghiChu) + "</div>" : "";
                return (
                    '<tr data-idx="' +
                    idx +
                    '"><td><div class="fw-semibold">' +
                    escapeHtml(item.ten || "Món") +
                    "</div>" +
                    gc +
                    '</td><td class="text-end">' +
                    formatVND(gia) +
                    '</td><td class="text-center"><button type="button" class="btn btn-sm btn-outline-secondary btn-qty" data-d="-1">−</button> ' +
                    '<span class="mx-1 fw-bold">' +
                    sl +
                    '</span> <button type="button" class="btn btn-sm btn-outline-secondary btn-qty" data-d="1">+</button></td><td class="text-end fw-bold">' +
                    formatVND(gia * sl) +
                    '</td><td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger btn-remove" title="Xóa"><i class="fa-solid fa-trash"></i></button></td></tr>'
                );
            })
            .join("");

        body.innerHTML =
            '<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Món</th><th class="text-end">Đơn giá</th><th class="text-center">SL</th><th class="text-end">Tạm tính</th><th></th></tr></thead><tbody>' +
            rows +
            "</tbody></table></div>" +
            '<p class="text-end fs-5 fw-bold">Tổng: ' +
            formatVND(total) +
            "</p>";
        if (summaryEl) summaryEl.textContent = cart.length + " món • Tổng " + formatVND(total);
        if (clearBtn) clearBtn.classList.remove("d-none");

        body.querySelectorAll(".btn-qty").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tr = btn.closest("tr");
                var idx = tr ? parseInt(tr.getAttribute("data-idx"), 10) : -1;
                var d = parseInt(btn.getAttribute("data-d"), 10);
                if (idx < 0 || !cart[idx]) return;
                cart[idx].soLuong = Math.max(1, Math.min(99, (Number(cart[idx].soLuong) || 1) + d));
                if (typeof luuGioHangChung === "function") luuGioHangChung(cart);
                renderCart();
            });
        });
        body.querySelectorAll(".btn-remove").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tr = btn.closest("tr");
                var idx = tr ? parseInt(tr.getAttribute("data-idx"), 10) : -1;
                if (idx < 0) return;
                cart.splice(idx, 1);
                if (typeof luuGioHangChung === "function") luuGioHangChung(cart);
                renderCart();
            });
        });
    }

    function clearCart() {
        var cart = typeof layGioHangChung === "function" ? layGioHangChung() : [];
        if (!cart.length) {
            showAlert("Giỏ hàng đang trống.", "error");
            return;
        }
        if (!confirm("Bạn chắc chắn muốn xóa toàn bộ giỏ hàng?")) return;
        if (typeof luuGioHangChung === "function") luuGioHangChung([]);
        showAlert("Đã xóa toàn bộ giỏ hàng.", "success");
        renderCart();
    }

    function showAlert(message, kind) {
        var el = $("guest-order-alert");
        if (!el) return;
        if (!message) {
            el.className = "d-none";
            el.innerHTML = "";
            return;
        }
        var klass = kind === "error" ? "alert-danger" : "alert-success";
        el.className = "alert " + klass + " mb-3";
        el.textContent = message;
    }

    function escapeHtml(s) {
        if (s == null) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    }

    async function loadTableInfo() {
        var el = $("table-info-line");
        if (!el) return;
        var token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
        if (!token) {
            el.textContent = "";
            return;
        }
        try {
            var res = await fetch(API_BASE + "/tables/qr/" + encodeURIComponent(token));
            var json = await res.json();
            if (!res.ok || json.success === false) throw new Error();
            var d = json.data != null ? json.data : json;
            el.textContent = "Bàn " + (d.tableNumber || "?") + (d.location ? " · " + d.location : "");
        } catch (e) {
            el.textContent = "Không tải được thông tin bàn.";
        }
    }

    function statusLabel(st) {
        var m = {
            PENDING: "Chờ xác nhận",
            PREPARING: "Đang chuẩn bị",
            SERVING: "Đang phục vụ",
            COMPLETED: "Hoàn thành",
            CANCELLED: "Đã hủy"
        };
        return m[st] || st || "—";
    }

    async function loadOrderStatus() {
        var box = $("order-status-box");
        if (!box) return;
        var token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
        if (!token) {
            box.innerHTML = "";
            return;
        }
        try {
            var res = await fetch(API_BASE + "/orders/guest/table/" + encodeURIComponent(token));
            var json = await res.json();
            if (!res.ok) throw new Error();
            var list = json.data != null ? json.data : json;
            if (!Array.isArray(list) || !list.length) {
                box.innerHTML = '<p class="small text-muted mb-0">Chưa có đơn đang xử lý cho bàn này.</p>';
                return;
            }
            box.innerHTML =
                '<h6 class="fw-bold mb-2">Đơn đang xử lý</h6><ul class="list-group list-group-flush">' +
                list
                    .map(function (o) {
                        return (
                            '<li class="list-group-item px-0 d-flex justify-content-between align-items-center"><span>Đơn #' +
                            (o.id != null ? o.id : "?") +
                            '</span><span class="badge bg-secondary">' +
                            statusLabel(o.status) +
                            "</span></li>"
                        );
                    })
                    .join("") +
                "</ul>";
            setGuestModeText("");
        } catch (e) {
            var demoList = readDemoOrders(token);
            if (!demoList.length) {
                box.innerHTML = '<p class="small text-warning mb-0">Không tải được trạng thái đơn (backend chưa sẵn sàng).</p>';
                setGuestModeText("Demo mode: đang thiếu API đơn hàng, chưa đồng bộ thời gian thực.");
                return;
            }
            box.innerHTML =
                '<h6 class="fw-bold mb-2">Đơn đang xử lý (demo)</h6><ul class="list-group list-group-flush">' +
                demoList
                    .map(function (o) {
                        return (
                            '<li class="list-group-item px-0 d-flex justify-content-between align-items-center"><span>Đơn #' +
                            (o.id != null ? o.id : "?") +
                            '</span><span class="badge bg-secondary">' +
                            statusLabel(o.status) +
                            "</span></li>"
                        );
                    })
                    .join("") +
                "</ul>";
            setGuestModeText("Demo mode: trạng thái đơn đang hiển thị từ dữ liệu cục bộ.");
        }
    }

    async function submitOrder() {
        if (isSubmittingOrder) return;
        var token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
        var guestName = ($("guestName") && $("guestName").value.trim()) || "";
        var note = ($("orderNote") && $("orderNote").value.trim()) || "";

        if (!token) {
            showAlert("Thiếu mã bàn (QR).", "error");
            return;
        }
        if (!guestName) {
            showAlert("Vui lòng nhập tên để nhà hàng phục vụ.", "error");
            $("guestName")?.focus();
            return;
        }

        var cart = typeof layGioHangChung === "function" ? layGioHangChung() : [];
        if (!cart.length) {
            showAlert("Giỏ hàng trống.", "error");
            return;
        }

        showAlert("", "success");

        var validItems = cart
            .map(function (i) {
                return {
                    menuItemId: Number(i.id),
                    quantity: Number(i.soLuong) || 1,
                    note: (i.ghiChu || "").trim() || undefined
                };
            })
            .filter(function (x) { return Number.isFinite(x.menuItemId) && x.menuItemId > 0; });

        if (!validItems.length) {
            showAlert("Giỏ hàng có dữ liệu không hợp lệ. Vui lòng thêm món lại từ menu.", "error");
            return;
        }

        var body = {
            guestName: guestName,
            qrToken: token,
            note: note || undefined,
            items: validItems
        };

        var btn = $("btn-submit-order");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Đang gửi…";
        }
        isSubmittingOrder = true;

        try {
            var res = await fetch(API_BASE + "/orders/guest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            var json = await res.json().catch(function () {
                return {};
            });
            var msg = json.message || (json.data && json.data.message) || "";
            if (!res.ok || json.success === false) {
                showAlert(msg || json.error || "Gửi đơn thất bại (" + res.status + ")", "error");
                return;
            }
            if (typeof luuGioHangChung === "function") luuGioHangChung([]);
            try { localStorage.setItem(LAST_GUEST_NAME_KEY, guestName); } catch (e0) {}
            if ($("orderNote")) $("orderNote").value = "";
            showAlert(msg || "Đặt món thành công!", "success");
            renderCart();
            loadOrderStatus();
            setGuestModeText("");
        } catch (e) {
            // Fallback demo mode khi backend chưa có endpoint /orders/guest
            addDemoOrder(token, body);
            if (typeof luuGioHangChung === "function") luuGioHangChung([]);
            showAlert("Backend chưa sẵn sàng. Đơn đã được lưu demo tại trình duyệt.", "error");
            renderCart();
            loadOrderStatus();
        } finally {
            isSubmittingOrder = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Gửi yêu cầu đặt món";
            }
        }
    }

    async function callStaff() {
        var token = typeof getActiveQrToken === "function" ? getActiveQrToken() : "";
        if (!token) {
            showAlert("Thiếu mã bàn (QR).", "error");
            return;
        }
        try {
            var res = await fetch(API_BASE + "/call-staff/guest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qrToken: token, note: "Khách bấm gọi nhân viên từ giỏ hàng" })
            });
            var json = await res.json().catch(function () {
                return {};
            });
            if (!res.ok) throw new Error(json.message || "Call staff failed");
            showAlert((json && json.message) || "Đã gửi yêu cầu hỗ trợ.", "success");
            setGuestModeText("");
        } catch (e) {
            addDemoCall(token);
            showAlert("Backend gọi nhân viên chưa sẵn sàng. Đã ghi nhận yêu cầu ở chế độ demo.", "error");
            setGuestModeText("Demo mode: yêu cầu gọi nhân viên được lưu cục bộ.");
        }
    }

    function setGuestModeText(text) {
        var el = $("guest-flow-mode");
        if (!el) return;
        el.textContent = text || "";
    }

    function readDemoOrders(token) {
        try {
            var all = JSON.parse(localStorage.getItem(DEMO_ORDERS_KEY) || "[]");
            return all.filter(function (o) { return o.qrToken === token; });
        } catch (e) {
            return [];
        }
    }

    function addDemoOrder(token, payload) {
        var all = [];
        try {
            all = JSON.parse(localStorage.getItem(DEMO_ORDERS_KEY) || "[]");
        } catch (e) {}
        all.unshift({
            id: Date.now(),
            qrToken: token,
            status: "PENDING",
            guestName: payload.guestName,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(all.slice(0, 30)));
    }

    function addDemoCall(token) {
        var all = [];
        try {
            all = JSON.parse(localStorage.getItem(DEMO_CALLS_KEY) || "[]");
        } catch (e) {}
        all.unshift({ qrToken: token, createdAt: new Date().toISOString(), status: "PENDING" });
        localStorage.setItem(DEMO_CALLS_KEY, JSON.stringify(all.slice(0, 50)));
    }

    document.addEventListener("DOMContentLoaded", function () {
        try {
            var lastName = localStorage.getItem(LAST_GUEST_NAME_KEY);
            if (lastName && $("guestName")) $("guestName").value = lastName;
        } catch (e) {}
        renderCart();
        loadTableInfo();
        loadOrderStatus();
        setInterval(loadOrderStatus, 15000);
        $("btn-submit-order")?.addEventListener("click", submitOrder);
        $("btn-call-staff")?.addEventListener("click", callStaff);
        $("btn-clear-cart")?.addEventListener("click", clearCart);
    });
})();

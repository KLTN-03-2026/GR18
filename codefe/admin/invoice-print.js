/**
 * Modal in hóa đơn (Thu ngân) — tách module, dùng chung fetch staff order detail.
 * In luôn theo khổ hóa đơn nhiệt ~80mm (CSS @page + invoice-print.css).
 * Cấu hình nhà hàng / ngân hàng: sửa INVOICE_PRINT_DEFAULTS hoặc ghi đè qua
 * localStorage key "restaurant_invoice_print_config" (JSON một phần, merge sâu 1 cấp).
 */
(function () {
    "use strict";

    const BASE_URL = (window.API_BASE || "").replace(/\/+$/, "");

    const INVOICE_PRINT_DEFAULTS = {
        restaurantName: "Restaurant AI",
        addressLine: "12 Lê Duẩn, Đà Nẵng, Việt Nam",
        phone: "0123456787",
        email: "abc@gmail.com",
        /** VietQR: mã ngân hàng theo img.vietqr.io (vd: VCB, TCB, BIDV, …) + số TK thật */
        bank: {
            displayName: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
            vietQrBankCode: "VCB",
            accountNumber: "0123456789",
            accountHolder: "CONG TY TNHH RESTAURANT AI"
        }
    };

    function getToken() {
        return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
    }

    function readConfig() {
        let extra = {};
        try {
            const raw = localStorage.getItem("restaurant_invoice_print_config");
            if (raw) extra = JSON.parse(raw);
        } catch (e) {
            /* ignore */
        }
        const bank = { ...INVOICE_PRINT_DEFAULTS.bank, ...(extra.bank || {}) };
        return {
            ...INVOICE_PRINT_DEFAULTS,
            ...extra,
            bank
        };
    }

    async function staffApi(path) {
        const auth = getToken();
        const res = await fetch(`${BASE_URL}${path}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth}`
            }
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
            throw new Error(json.message || `Lỗi ${res.status}`);
        }
        return json.data;
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatCurrency(n) {
        return Number(n || 0).toLocaleString("vi-VN") + " đ";
    }

    function formatDateTimeFull(raw) {
        if (raw == null) return "—";
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return String(raw);
        return d.toLocaleString("vi-VN", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    function translateOrderStatus(status) {
        return (
            {
                PENDING: "Đơn mới",
                PREPARING: "Đang chuẩn bị",
                SERVING: "Đang phục vụ",
                COMPLETED: "Hoàn thành",
                CANCELLED: "Đã hủy"
            }[status] || status || "—"
        );
    }

    function invoiceCodeFromOrder(id) {
        return `HD${id}`;
    }

    function transferContentForOrder(id) {
        return `THANHTOAN_HD${id}`;
    }

    function tableLabel(d) {
        if (d.tableNumber != null && String(d.tableNumber).trim() !== "") {
            return `Bàn ${d.tableNumber}`;
        }
        if (d.tableId != null) return `Bàn #${d.tableId}`;
        return "—";
    }

    function buildVietQrImageUrl(cfg, orderId, totalAmount) {
        const code = cfg.bank.vietQrBankCode;
        const acc = String(cfg.bank.accountNumber || "").replace(/\s/g, "");
        if (!code || !acc) return null;
        const addInfo = transferContentForOrder(orderId);
        const params = new URLSearchParams();
        const amt = Math.round(Number(totalAmount || 0));
        if (amt > 0) params.set("amount", String(amt));
        params.set("addInfo", addInfo);
        const holder = String(cfg.bank.accountHolder || "").trim();
        if (holder) params.set("accountName", holder);
        return `https://img.vietqr.io/image/${encodeURIComponent(String(code).trim())}-${encodeURIComponent(acc)}-compact2.png?${params.toString()}`;
    }

    function buildQrFallbackPayload(cfg, orderId, totalAmount) {
        const lines = [
            "Chuyen khoan",
            cfg.bank.displayName,
            `STK: ${cfg.bank.accountNumber}`,
            `Chu TK: ${cfg.bank.accountHolder}`,
            `So tien: ${formatCurrency(totalAmount)}`,
            `Noi dung: ${transferContentForOrder(orderId)}`
        ];
        return lines.join("\n");
    }

    /** Map StaffOrderResponse (danh sách chưa thu) → dạng giống chi tiết để in ngay. */
    function summaryToInvoiceDraft(summary, orderId) {
        const id = Number(orderId);
        if (!summary || Number(summary.id) !== id) {
            return {
                id,
                tableId: null,
                tableNumber: null,
                guestName: null,
                totalAmount: 0,
                status: null,
                paymentStatus: null,
                paymentMethod: null,
                paidAt: null,
                createdAt: null,
                note: null,
                items: [],
                _invoiceItemsPending: true
            };
        }
        return {
            id: summary.id,
            tableId: summary.tableId,
            tableNumber: summary.tableNumber,
            guestName: summary.guestName,
            totalAmount: summary.totalAmount,
            status: summary.status,
            paymentStatus: summary.paymentStatus,
            paymentMethod: summary.paymentMethod,
            paidAt: summary.paidAt,
            createdAt: summary.createdAt,
            note: summary.note,
            items: [],
            _invoiceItemsPending: true
        };
    }

    function renderLineItems(items, itemsPending) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) {
            if (itemsPending) {
                return '<tr><td colspan="4" class="inv-p-cell text-center text-muted">Đang tải danh sách món…</td></tr>';
            }
            return '<tr><td colspan="4" class="inv-p-cell text-center text-muted">Không có món.</td></tr>';
        }
        return list
            .map((it) => {
                const note = it.note ? `<div class="inv-item-note">${escapeHtml(it.note)}</div>` : "";
                return `<tr>
                    <td class="inv-p-cell"><span class="inv-item-name">${escapeHtml(it.itemName || "Món")}</span>${note}</td>
                    <td class="inv-p-cell text-center">${it.quantity != null ? escapeHtml(String(it.quantity)) : "—"}</td>
                    <td class="inv-p-cell text-end">${formatCurrency(it.unitPrice)}</td>
                    <td class="inv-p-cell text-end fw-semibold">${formatCurrency(it.subtotal)}</td>
                </tr>`;
            })
            .join("");
    }

    function buildQrImageDataUrl(cfg, orderId, totalAmount) {
        const text = buildQrFallbackPayload(cfg, orderId, totalAmount);
        return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(text)}`;
    }

    function renderInvoiceSheet(d, cfg) {
        const code = invoiceCodeFromOrder(d.id);
        const transferText = transferContentForOrder(d.id);
        const vietQrUrl = buildVietQrImageUrl(cfg, d.id, d.totalAmount);
        const qrSrc = vietQrUrl || buildQrImageDataUrl(cfg, d.id, d.totalAmount);
        const qrBlock = `<div class="inv-qr-wrap">
                <img class="inv-qr-img" src="${escapeHtml(qrSrc)}" width="240" height="240" alt="Mã QR chuyển khoản" />
               </div>`;

        return `
            <div class="inv-print-inner">
                <header class="inv-header text-center">
                    <h1 class="inv-brand">${escapeHtml(cfg.restaurantName)}</h1>
                    <p class="inv-meta mb-0">Địa chỉ: ${escapeHtml(cfg.addressLine)}</p>
                    <p class="inv-meta mb-0">SĐT: ${escapeHtml(cfg.phone)}</p>
                    ${cfg.email ? `<p class="inv-meta mb-0">Gmail: ${escapeHtml(cfg.email)}</p>` : ""}
                </header>
                <div class="inv-divider"></div>
                <h2 class="inv-title text-center">HÓA ĐƠN</h2>
                <div class="inv-grid">
                    <div><span class="inv-k">Mã hóa đơn:</span> <span class="inv-v">${escapeHtml(code)}</span></div>
                    <div><span class="inv-k">Mã đơn:</span> <span class="inv-v">#${d.id}</span></div>
                    <div><span class="inv-k">Thời gian tạo:</span> <span class="inv-v">${escapeHtml(formatDateTimeFull(d.createdAt))}</span></div>
                    <div><span class="inv-k">Số bàn:</span> <span class="inv-v">${escapeHtml(tableLabel(d))}</span></div>
                    <div><span class="inv-k">Khách:</span> <span class="inv-v">${escapeHtml(d.guestName || "Khách vãng lai")}</span></div>
                    <div><span class="inv-k">Trạng thái đơn:</span> <span class="inv-v">${escapeHtml(translateOrderStatus(d.status))}</span></div>
                </div>
                ${d.note && String(d.note).trim() ? `<div class="inv-note border rounded p-2 mb-3 small"><span class="text-muted">Ghi chú đơn:</span><br>${escapeHtml(d.note).replace(/\n/g, "<br>")}</div>` : ""}
                <div class="table-responsive inv-table-wrap">
                    <table class="inv-items-table w-100">
                        <thead>
                            <tr>
                                <th class="inv-p-cell">Món</th>
                                <th class="inv-p-cell text-center" style="width:3.5rem">SL</th>
                                <th class="inv-p-cell text-end" style="width:6.5rem">Đơn giá</th>
                                <th class="inv-p-cell text-end" style="width:7rem">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>${renderLineItems(d.items, !!d._invoiceItemsPending)}</tbody>
                    </table>
                </div>
                <p class="inv-total text-end mb-4">Tổng cộng: <strong>${formatCurrency(d.totalAmount)}</strong></p>
                <div class="inv-divider"></div>
                <section class="inv-bank-section text-center">
                    <p class="inv-bank-line mb-1"><span class="inv-k">Ngân hàng:</span> ${escapeHtml(cfg.bank.displayName)}</p>
                    <p class="inv-bank-line mb-1"><span class="inv-k">Số tài khoản:</span> <span class="inv-mono">${escapeHtml(cfg.bank.accountNumber)}</span></p>
                    <p class="inv-bank-line mb-1"><span class="inv-k">Chủ tài khoản:</span> ${escapeHtml(cfg.bank.accountHolder)}</p>
                    <p class="inv-bank-line mb-3"><span class="inv-k">Nội dung CK:</span> <span class="inv-mono fw-bold">${escapeHtml(transferText)}</span></p>
                    ${qrBlock}
                    <p class="small text-muted mt-2 mb-0">Vui lòng chuyển đúng số tiền và nội dung để đối soát nhanh.</p>
                </section>
            </div>
        `;
    }

    function openInvoicePrintModal() {
        const modalEl = document.getElementById("invoice-print-modal");
        if (modalEl && window.bootstrap) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    }

    async function openInvoicePrint(orderId) {
        const sheet = document.getElementById("invoice-print-sheet");
        const titleEl = document.getElementById("invoice-print-modal-title");
        const errEl = document.getElementById("invoice-print-error");
        if (!sheet) return;
        if (errEl) {
            errEl.classList.add("d-none");
            errEl.textContent = "";
        }
        if (titleEl) titleEl.textContent = `In hóa đơn · Đơn #${orderId}`;

        const partial =
            typeof window.getUnpaidOrderSummaryForPrint === "function"
                ? window.getUnpaidOrderSummaryForPrint(orderId)
                : null;
        const cfg = readConfig();

        if (partial) {
            sheet.innerHTML = renderInvoiceSheet(summaryToInvoiceDraft(partial, orderId), cfg);
        } else {
            sheet.innerHTML = '<p class="text-secondary text-center py-5 mb-0">Đang tải hóa đơn…</p>';
        }
        openInvoicePrintModal();

        try {
            const d = await staffApi(`/staff/orders/${orderId}`);
            if (d && typeof d === "object") delete d._invoiceItemsPending;
            sheet.innerHTML = renderInvoiceSheet(d, cfg);
        } catch (err) {
            if (!partial) {
                sheet.innerHTML = "";
                if (errEl) {
                    errEl.textContent = err.message || "Không tải được hóa đơn.";
                    errEl.classList.remove("d-none");
                }
            }
            /* Có tóm tắt từ danh sách: giữ hóa đơn hiển thị, không nhấn mạnh lỗi API chi tiết. */
        }
    }

    function runPrint() {
        window.print();
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("btn-invoice-print-action")?.addEventListener("click", runPrint);
    });

    window.openInvoicePrint = openInvoicePrint;
    window.runInvoicePrintDialog = runPrint;
})();

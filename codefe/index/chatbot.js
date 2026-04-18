const CHATBOT_API_BASE = window.RESTAURANT_API_BASE || "http://localhost:8080/api";
const CHAT_ENDPOINTS = [`${CHATBOT_API_BASE}/chat`, `${CHATBOT_API_BASE}/chatbot`];
const MENU_FALLBACK_IMAGE =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">' +
            '<rect fill="#f1f3f5" width="72" height="72"/>' +
            '<text x="36" y="39" text-anchor="middle" font-size="10" fill="#6c757d" font-family="system-ui,sans-serif">Food</text>' +
            "</svg>"
    );

const launcher = document.getElementById("chat-launcher");
const windowChat = document.getElementById("chat-window");
const closeBtn = document.getElementById("chat-close");
const sendBtn = document.getElementById("chat-send");
const input = document.getElementById("chat-input");
const body = document.getElementById("chat-body");

let isSending = false;

if (launcher && windowChat) {
    launcher.onclick = () => {
        windowChat.classList.toggle("d-none");
        if (!windowChat.classList.contains("d-none")) {
            input?.focus();
            scrollToBottom();
            renderQuickActions();
        }
    };
}

if (closeBtn && windowChat) {
    closeBtn.onclick = () => windowChat.classList.add("d-none");
}

async function handleSend(presetText) {
    if (isSending || !input || !body) return;
    const text = (presetText || input.value || "").trim();
    if (!text) return;

    isSending = true;
    appendMessage("user", text);
    input.value = "";
    input.disabled = true;

    const loadingId = appendMessage("bot", '<span class="typing">Đang trả lời...</span>', true);

    try {
        const botReply = await getBotReply(text);
        removeMessage(loadingId);
        appendMessage("bot", botReply.reply || "Mình chưa hiểu rõ, bạn nói kỹ hơn giúp mình nhé.");
        if (Array.isArray(botReply.items) && botReply.items.length) {
            appendFoodList(botReply.items.slice(0, 4));
        }
    } catch (error) {
        console.error("Chatbot error:", error);
        removeMessage(loadingId);
        appendMessage("bot", "Có sự cố khi xử lý tin nhắn. Bạn thử lại sau ít phút nhé.");
    } finally {
        input.disabled = false;
        input.focus();
        isSending = false;
    }
}

async function getBotReply(text) {
    const remote = await askBackendChat(text);
    if (remote) return remote;
    return askLocalAssistant(text);
}

async function askBackendChat(text) {
    const token = localStorage.getItem("accessToken");
    const payload = { message: text, sessionId: getSessionId() };

    for (const endpoint of CHAT_ENDPOINTS) {
        try {
            const response = await fetchWithTimeout(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            }, 10000);

            const json = await response.json();
            if (!response.ok) continue;

            return {
                reply: json.reply || json.message || "Mình đã nhận câu hỏi của bạn.",
                items: Array.isArray(json.data) ? json.data : []
            };
        } catch (_err) {
            // thử endpoint tiếp theo
        }
    }
    return null;
}

async function askLocalAssistant(text) {
    const normalized = normalizeText(text);
    const menuItems = await getMenuForSuggestion();
    const topItems = menuItems.slice(0, 3);

    if (containsAny(normalized, ["menu", "thuc don", "mon an", "goi y", "an gi"])) {
        return {
            reply: topItems.length
                ? "Mình gợi ý một vài món đang được quan tâm. Bạn muốn món no, món nhẹ hay đồ uống để mình lọc chính xác hơn?"
                : "Hiện mình chưa tải được menu từ server. Bạn có thể xem trực tiếp tại trang Menu.",
            items: topItems
        };
    }

    if (containsAny(normalized, ["dat ban", "book ban", "giu cho", "reservation"])) {
        return {
            reply: "Bạn có thể đặt bàn rất nhanh ở trang Đặt bàn. Mình mở trang cho bạn tại đây: datban.html"
        };
    }

    if (containsAny(normalized, ["gio hang", "cart", "don hang"])) {
        return {
            reply: `Bạn có thể kiểm tra giỏ hàng tại ${appendQrToHrefIfAny("giohang.html")}. Nếu cần, mình sẽ gợi ý thêm món phù hợp với món bạn đã chọn.`
        };
    }

    if (containsAny(normalized, ["xin chao", "hello", "hi", "chao"])) {
        return {
            reply: "Xin chào! Mình có thể hỗ trợ gợi ý món ăn, chỉ đường sang trang đặt bàn, hoặc tìm món theo khẩu vị/giá."
        };
    }

    return {
        reply: "Mình đã ghi nhận câu hỏi của bạn. Bạn có thể thử các từ khoá: 'gợi ý món', 'đặt bàn', 'xem giỏ hàng' để mình hỗ trợ nhanh hơn."
    };
}

function getSessionId() {
    let sessionId = localStorage.getItem("chat_session");
    if (!sessionId) {
        sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        localStorage.setItem("chat_session", sessionId);
    }
    return sessionId;
}

function appendMessage(sender, text, allowHtml) {
    const id = `chat_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const div = document.createElement("div");
    div.id = id;
    div.className = `msg-item ${sender} mb-3`;

    const alignmentClass = sender === "user" ? "justify-content-end" : "justify-content-start";
    const bgClass = sender === "user" ? "bg-orange text-white" : "bg-light text-dark";
    const safeText = allowHtml ? text : nl2br(escapeHtml(text));

    div.innerHTML = `
        <div class="d-flex ${alignmentClass}">
            <div class="d-flex align-items-start" style="max-width: 85%;">
                ${sender === "bot" ? '<i class="fa-solid fa-robot text-orange me-2 mt-2"></i>' : ""}
                <div class="p-2 rounded shadow-sm ${bgClass}" style="font-size: 14px; line-height: 1.5;">
                    ${safeText}
                </div>
            </div>
        </div>
    `;

    body.appendChild(div);
    scrollToBottom();
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function appendFoodList(items) {
    const wrapper = document.createElement("div");
    wrapper.className = "food-list";

    items.forEach((item) => {
        const div = document.createElement("button");
        div.type = "button";
        div.className = "food-card";
        div.onclick = () => {
            if (item.id) {
                window.location.href = appendQrToHrefIfAny(`menu-detail.html?id=${encodeURIComponent(item.id)}`);
            } else {
                window.location.href = "menu.html";
            }
        };

        const name = escapeHtml(item.name || item.ten || "Món ăn");
        const price = item.formattedPrice || formatVND(item.price || item.gia || 0);
        const image = item.imageUrl || item.image || MENU_FALLBACK_IMAGE;

        div.innerHTML = `
            <img src="${image}" alt="${name}" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${MENU_FALLBACK_IMAGE}';}">
            <div class="food-meta">
                <div class="food-name">${name}</div>
                <div class="food-price">${escapeHtml(price)}</div>
            </div>
        `;

        wrapper.appendChild(div);
    });

    body.appendChild(wrapper);
    scrollToBottom();
}

function renderQuickActions() {
    if (document.getElementById("chat-quick-actions")) return;
    if (!body) return;

    const wrapper = document.createElement("div");
    wrapper.id = "chat-quick-actions";
    wrapper.className = "quick-actions";
    wrapper.innerHTML = `
        <button type="button" class="quick-btn" data-msg="Gợi ý món nổi bật">Gợi ý món</button>
        <button type="button" class="quick-btn" data-msg="Mình muốn đặt bàn">Đặt bàn</button>
        <button type="button" class="quick-btn" data-msg="Xem giỏ hàng giúp mình">Giỏ hàng</button>
    `;

    wrapper.addEventListener("click", (e) => {
        const btn = e.target.closest(".quick-btn");
        if (!btn) return;
        input.value = btn.dataset.msg || "";
        handleSend();
    });

    body.appendChild(wrapper);
    scrollToBottom();
}

async function getMenuForSuggestion() {
    try {
        const response = await fetchWithTimeout(`${CHATBOT_API_BASE}/menu`, { method: "GET" }, 8000);
        const json = await response.json();
        const data = Array.isArray(json.data) ? json.data : [];
        return data
            .slice()
            .sort((a, b) => Number(b.avgRating || b.rating || 0) - Number(a.avgRating || a.rating || 0));
    } catch (_err) {
        return [];
    }
}

function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 8000);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function containsAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
}

function appendQrToHrefIfAny(path) {
    if (typeof window.appendQrToHref === "function") return window.appendQrToHref(path);
    return path;
}

function formatVND(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function nl2br(text) {
    return text.replace(/\n/g, "<br>");
}

function scrollToBottom() {
    if (!body) return;
    body.scrollTop = body.scrollHeight;
}

if (sendBtn) sendBtn.onclick = () => handleSend();

if (input) {
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
        }
    });
}
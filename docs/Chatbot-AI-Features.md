# Tài liệu mô tả chức năng Chatbot AI

> Phần đặc tả này mô tả toàn bộ thành phần Chatbot AI trong hệ thống Restaurant (Nhóm 18) — phục vụ chương phân tích thiết kế và phụ lục đồ án. Nội dung được trích lập trực tiếp từ source code (`codefe/` + `restaurant-backend1/`).

---

## 1. Tóm tắt

Chatbot là **trợ lý hội thoại trên trang khách** giúp người dùng:

- Hỏi đáp thực đơn theo nhiều tiêu chí (giá, danh mục, khẩu vị, dị ứng, signature, top bán chạy, đánh giá cao/thấp…).
- Nhận **gợi ý món** kèm thẻ ảnh để click trực tiếp sang trang chi tiết.
- **Đặt bàn nhanh trong hội thoại** (multi-turn: hỏi ngày → giờ → số khách → xác nhận → tạo reservation).
- Lưu **lịch sử chat theo phiên** để admin có thể truy soát.

Kiến trúc dùng **Hybrid AI**: rule-engine bằng Java làm tầng chính, có khả năng gọi **Google Gemini REST API (model `gemini-2.5-flash`)** để rerank danh sách gợi ý. Khi không có `GEMINI_API_KEY` hoặc bị admin tắt, hệ thống tự động fallback về rule-engine — không gián đoạn dịch vụ.

---

## 2. Phạm vi chức năng

### 2.1 Đối với người dùng (Guest / Customer)

| Mã | Tên chức năng | Mô tả ngắn |
|---|---|---|
| CB-01 | Mở/đóng widget chat | Nút bóng nổi cố định góc phải dưới; mở popup chat |
| CB-02 | Lời chào tự động | Tin nhắn chào của bot khi mở chat lần đầu |
| CB-03 | Nút thao tác nhanh | "Gợi ý món" / "Đặt bàn" / "Giỏ hàng" |
| CB-04 | Gửi tin nhắn tự do | Người dùng nhập câu hỏi và nhận trả lời |
| CB-05 | Gợi ý món có thẻ ảnh | Bot đính kèm tối đa 4 thẻ món (ảnh + giá), click → mở chi tiết |
| CB-06 | Phản hồi gợi ý | Khi click thẻ món, FE tự báo backend "đã chọn món X từ lượt gợi ý Y" |
| CB-07 | Phiên hội thoại bền | `sessionId` lưu trong `localStorage` để giữ ngữ cảnh nhiều phiên truy cập |
| CB-08 | Hỏi đáp thực đơn | Hỗ trợ các ý hỏi: giá cao/thấp nhất, top bán chạy, đánh giá cao/thấp, theo danh mục, cay/không cay, chay, healthy, gluten, dị ứng đậu phộng/sữa, signature, combo nhóm N người… |
| CB-09 | Đặt bàn qua chat | Hội thoại multi-turn để gom đủ ngày/giờ/số khách → xác nhận → tạo reservation (yêu cầu đã đăng nhập ở bước xác nhận cuối) |
| CB-10 | Local fallback | Khi backend lỗi, FE vẫn trả gợi ý cơ bản dựa trên endpoint `/menu` |

### 2.2 Đối với Admin (`/admin/ai`)

| Mã | Tên chức năng | Mô tả ngắn |
|---|---|---|
| AI-01 | Bật/tắt toàn bộ AI | `aiEnabled` — tắt thì bot trả lời thông báo "đang tạm tắt" |
| AI-02 | Bật/tắt gọi Gemini | `geminiEnabled` — tắt chỉ dùng rule + DB |
| AI-03 | Cấu hình timeout Gemini | 800 – 10000 ms (mặc định 2800) |
| AI-04 | Ẩn danh thống kê | Log chỉ lưu SHA-256 của sessionId, không lưu nội dung user |
| AI-05 | Ghim món ưu tiên | Admin tích chọn các món ưu tiên hiện trước trong list gợi ý |
| AI-06 | Trạng thái API key | Badge hiển thị "Đã cấu hình key Gemini (env)" hay "Chưa có key" |
| AI-07 | Thống kê gợi ý | Tổng số lượt gợi ý, số lượt khách chọn, tỉ lệ chấp nhận |
| AI-08 | Lịch sử lượt gợi ý | Bảng 100 lượt mới nhất + phân trang client-side (10/trang) |

### 2.3 Phạm vi KHÔNG triển khai (làm rõ ranh giới)

- **Không có** vector store / embedding / RAG đúng nghĩa. Cách dùng Gemini hiện tại là **ID-grounded prompting**: gửi toàn bộ tập món đang bán làm "danh sách hợp lệ" trong prompt và lọc kết quả phải nằm trong tập đó.
- **Không có** WebSocket / streaming cho chat — toàn bộ chat dùng REST `POST /api/chat`.
- **Không có** fine-tune / training riêng cho model.
- **Không có** đa ngôn ngữ — toàn bộ ý định và prompt là tiếng Việt.

---

## 3. Kiến trúc thành phần

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                  │
│  codefe/index/chatbot.html  ─ HTML widget (launcher + popup window)    │
│  codefe/index/chatbot.css   ─ Style widget + responsive viewport       │
│  codefe/index/chatbot.js    ─ Logic: gửi tin, render bot/user, session │
│  Embedded ở: home, menu, menu-detail, danhgia, qr-menu (lazy-load)     │
│  Admin AI:  codefe/admin/ai.{html,js,css}                              │
└────────────┬───────────────────────────────────────────────────────────┘
             │ POST /api/chat   |  POST /api/chat/suggestion-feedback
             │ POST /api/chatbot| (alias)
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Spring Boot 3.5)                        │
│  ChatController          ─ REST entry, đọc Authentication (tùy chọn)   │
│  ChatService             ─ Orchestrator intent (chào / menu / đặt bàn) │
│  ChatMenuAssistant       ─ Rule engine ý hỏi menu (~30 nhánh intent)   │
│  AiMenuRecommendationSrv ─ Xếp hạng rule (rating + sales + pinned)     │
│  GeminiMenuSuggestionSrv ─ Gọi REST Gemini, rerank id-grounded         │
│  AiSuggestionLogService  ─ Log SHA-256(session) + id list + acceptance │
│  BookingSessionManager   ─ ConcurrentHashMap<sessionId, BookingCtx>    │
│  AiAdminController/Svc   ─ Endpoint /admin/ai (config/stats/logs)      │
└─────────┬──────────────────────────────────────────┬───────────────────┘
          │                                          │
          │ JPA                                       │ HTTP (HttpClient)
          ▼                                          ▼
┌─────────────────────┐                  ┌────────────────────────────┐
│      MySQL          │                  │  Google Gemini REST API    │
│  chatbot_messages   │                  │  generativelanguage.       │
│  ai_system_config   │                  │  googleapis.com/v1/models/ │
│  ai_suggestion_logs │                  │  gemini-2.5-flash          │
│  menu_items, ...    │                  └────────────────────────────┘
└─────────────────────┘
```

---

## 4. API hợp đồng

### 4.1 `POST /api/chat` (alias `POST /api/chatbot`)

Public — không bắt buộc JWT. Nếu có JWT, hệ thống biết được `user` để thực hiện đặt bàn.

**Request**

```json
{
  "message": "gợi ý món hải sản đi",
  "sessionId": "f1d6e8a1-..."
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `message` | Có (NotBlank) | Tin nhắn người dùng (tiếng Việt) |
| `sessionId` | Không | Nếu rỗng, backend sinh UUID mới |

**Response** (`ChatResponse`)

```json
{
  "reply":  "Món hải sản được nhiều khách khen / gọi nhiều:",
  "status": "success",
  "data":   [ { "id": 12, "name": "Tôm hùm sốt bơ tỏi", "price": 590000, "imageUrl": "...", ... } ],
  "suggestionLogId": 4821
}
```

| Trường | Loại | Mô tả |
|---|---|---|
| `reply` | string | Câu trả lời tóm tắt của bot |
| `data` | `List<MenuItemResponse>` \| null | Tối đa 5 món được gợi ý |
| `suggestionLogId` | long? | Id để FE gọi feedback khi khách click thẻ món |

### 4.2 `POST /api/chat/suggestion-feedback`

Public. Khách click 1 thẻ món → ghi nhận lượt gợi ý đã thành công.

**Request**

```json
{ "suggestionLogId": 4821, "menuItemId": 12 }
```

Server xác thực `menuItemId` thuộc tập đã được gợi ý ở log đó (chống spam).

### 4.3 `GET /api/admin/ai/config` | `PUT /api/admin/ai/config`

Cần JWT, ROLE_ADMIN. Lấy/cập nhật `AiSystemConfig` (singleton id=1).

### 4.4 `GET /api/admin/ai/stats` | `GET /api/admin/ai/suggestions/recent`

Cần JWT, ROLE_ADMIN. Trả thống kê và 100 log mới nhất.

---

## 5. Mô hình dữ liệu

### 5.1 `chatbot_messages`

```sql
CREATE TABLE chatbot_messages (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT NULL,                          -- FK users.id (SET NULL khi xóa user)
    menu_item_id BIGINT NULL,                          -- FK menu_items.id (gắn nếu cần)
    session_id   VARCHAR(255) NOT NULL,                -- UUID do FE sinh + lưu localStorage
    sender       VARCHAR(20)  NOT NULL,                -- 'USER' | 'BOT'
    message      TEXT         NOT NULL,
    intent       VARCHAR(100) NULL,                    -- (chưa dùng — chừa cho NLU tương lai)
    confidence   DOUBLE       NULL,
    metadata     JSON         NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_session_time  ON chatbot_messages(session_id, created_at);
CREATE INDEX idx_chat_intent        ON chatbot_messages(intent);
CREATE INDEX idx_chat_created_at    ON chatbot_messages(created_at);
```

### 5.2 `ai_system_config` (singleton)

| Cột | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `id` | BIGINT | 1 | Khoá cứng, chỉ có 1 dòng |
| `ai_enabled` | TINYINT | 1 | Tắt → bot trả "tạm tắt" |
| `gemini_enabled` | TINYINT | 1 | Cho phép gọi Gemini |
| `pinned_menu_item_ids_json` | VARCHAR(4000) | `[]` | Mảng id món ưu tiên hiện trước |
| `restrict_category_ids_json` | VARCHAR(2000) | `[]` | Giới hạn danh mục (rỗng = mọi danh mục) |
| `history_lookback_days` | INT | 90 | Số ngày tham chiếu lịch sử (chừa) |
| `rating_weight` | DOUBLE | 0.65 | Trọng số đánh giá |
| `sales_weight` | DOUBLE | 0.35 | Trọng số bán chạy |
| `gemini_timeout_ms` | INT | 2800 | Timeout gọi Gemini |
| `anonymize_analytics` | TINYINT | 1 | Hash session khi log |
| `updated_at` | DATETIME | — | Auto cập nhật |

### 5.3 `ai_suggestion_logs`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | BIGINT | PK |
| `created_at` | DATETIME | Thời điểm log |
| `session_hash` | VARCHAR(64) | **SHA-256 hex** của `sessionId` (không lưu session gốc — privacy) |
| `source` | VARCHAR(20) | `RULE_ENGINE` \| `GEMINI` \| `HYBRID` |
| `suggested_item_ids_json` | VARCHAR(4000) | Mảng id món đã đề xuất |
| `reply_preview` | VARCHAR(500) | Tiêu đề rút gọn của câu trả lời |
| `accepted_menu_item_id` | BIGINT? | Món khách đã click |
| `accepted_at` | DATETIME? | Thời điểm click |

---

## 6. Prompt gửi Gemini

`GeminiMenuSuggestionService.buildPrompt()` ghép prompt như sau (mô tả nguyên văn, không có "system message" tách biệt vì gọi REST raw):

```
Bạn là trợ lý nhà hàng. Chỉ trả về một JSON object duy nhất dạng {"ids":[...]}
gồm tối đa 5 số id món phù hợp với ý khách (tiếng Việt).
Tuyệt đối không thêm id ngoài danh sách.
Không giải thích, không markdown, không text ngoài JSON.
Tin nhắn khách: <message>
Danh sách món hợp lệ:
- id:<id> name:<name> cat:<categoryName> desc:<description, cắt 160 ký tự>
- ...
```

Lý do thiết kế:

- **Giới hạn dữ liệu** gửi cho LLM ở tập món đang `isActive=true AND isAvailable=true`. Khi parse, mọi id ngoài danh sách bị loại (`parseIdsFromModelText`).
- **Không cho LLM tự sinh câu trả lời** mà chỉ rerank — câu trả lời cuối vẫn do backend dựng (đảm bảo định dạng đồng nhất, hiển thị thẻ món).
- **Tiết kiệm token** + **giữ ngữ pháp tiếng Việt** ổn định, không phụ thuộc khả năng diễn đạt của model.

---

## 7. Quản lý ngữ cảnh hội thoại

### 7.1 Lịch sử chat (persistent)

- Tất cả tin nhắn `USER` và `BOT` đều được lưu vào `chatbot_messages` cùng `session_id` và `user_id` (nếu có JWT).
- Truy vấn `findTop20BySessionIdOrderByCreatedAtDesc` đã sẵn sàng cho mục đích "đọc lại lịch sử", nhưng phiên bản hiện tại không gửi history vào prompt Gemini (mỗi lượt gọi là stateless).

### 7.2 Ngữ cảnh đặt bàn (in-memory, ephemeral)

- `BookingSessionManager` dùng `ConcurrentHashMap<sessionId, BookingContext>` — sống trong RAM tiến trình JVM.
- `BookingContext { date, time, guests, confirmed }`.
- Quy tắc:
  1. Nếu tin nhắn chứa "đặt bàn" → **clear** context cũ, bắt đầu mới.
  2. Trích `ngày` (hôm nay / mai), `giờ` (`HH:mm`), `số người` (`\d+ người`) bằng regex.
  3. Còn thiếu trường nào thì hỏi tiếp.
  4. Khi đủ 3 trường → bot gửi câu xác nhận → user trả "ok"/"đúng" → tạo reservation (yêu cầu JWT).
  5. Sau khi tạo thành công hoặc khi user nhập tin nhắn khác chủ đề → clear context.

> Hệ quả: nếu server restart, context đặt bàn dở dang sẽ mất. Lựa chọn này được chấp nhận vì khách thường hoàn tất đặt bàn trong vài phút.

---

## 8. Phân loại intent của Chatbot (rule engine)

Bảng tóm tắt các nhánh chính trong `ChatMenuAssistant`:

| Nhóm intent | Ví dụ câu | Hành vi |
|---|---|---|
| Chào | "xin chào", "hi" | Trả câu chào tổng quát |
| Đặt bàn | "đặt bàn tối mai 19:30 cho 4 người" | Vào nhánh booking multi-turn |
| Món thịt ngon | "có món thịt nào ngon không" | Lọc keyword `thịt/bò/heo/steak…`, loại trừ há cảo/dumpling |
| Sushi/sashimi | "sushi có món gì" | Lọc keyword sushi/sashimi/maki/nigiri |
| Hải sản | "hải sản gì ngon" | Lọc tôm/cua/mực/sò/ghẹ/ngao/cá hồi |
| Đắt nhất | "món đắt nhất" | Sort `price DESC`, lấy 6 |
| Rẻ nhất | "rẻ nhất", "giá thấp nhất" | Sort `price ASC`, lấy 6 |
| Top bán chạy | "bán chạy", "gọi nhiều nhất" | `recommendTopSellingFood(5)` |
| Top đánh giá | "đánh giá cao", "5 sao" | `recommendTopRatedFood(5)` |
| Đánh giá thấp | "rating thấp", "bị chê" | `recommendLowRatedFood(5)` |
| Theo ngân sách | "dưới 100k", "lọc 50k" | Parse cap VND → filter price ≤ cap |
| Theo danh mục | "lẩu có gì", "tráng miệng" | Match `category.name` → list |
| Không cay / cay / chay / healthy / gluten / đậu phộng / sữa | tương ứng | Lọc keyword mô tả + bú toàn pool |
| Signature | "món signature", "đặc trưng" | `recommendTop(5, true)` |
| Nhóm N người | "ăn cho 4 người" | `suggestPopularDishes(5)` |
| Overview menu | "menu có gì", "xem menu" | Liệt kê category + top 5 |
| Casual food | "đói quá", "có gì ngon" | `suggestPopularDishes(5)` |

---

## 9. Phân quyền và bảo mật

| Endpoint | Quyền | Ghi chú |
|---|---|---|
| `POST /api/chat`, `POST /api/chatbot` | Public (permitAll) | Nhận JWT optional để biết user khi đặt bàn |
| `POST /api/chat/suggestion-feedback` | Public | Validate `menuItemId ∈ suggestedItemIdsJson` |
| `GET/PUT /api/admin/ai/config` | ROLE_ADMIN | `@PreAuthorize("hasRole('ADMIN')")` |
| `GET /api/admin/ai/stats` | ROLE_ADMIN | |
| `GET /api/admin/ai/suggestions/recent` | ROLE_ADMIN | |

Tham chiếu: `restaurant-backend1/src/main/java/com/restaurant/config/SecurityConfig.java` dòng 72 cho phép `/chat/**` và `/chatbot/**`.

**Riêng tư**:

- `ai_suggestion_logs.session_hash` lưu **SHA-256(sessionId)** — không phục hồi được sessionId gốc.
- Cấu hình `anonymizeAnalytics` (mặc định `true`) đảm bảo không lưu nội dung user vào log gợi ý.
- `chatbot_messages` **có** lưu nội dung tin nhắn (cho mục đích vận hành/QA). Nếu cần GDPR-style, cần thêm chính sách xoá định kỳ.

---

## 10. Biến môi trường (`.env`)

```env
# Bắt buộc nếu muốn bật Gemini rerank
GEMINI_API_KEY=AIza...
```

Mapping trong `application.properties`:

```properties
google.gemini.api.key=${GEMINI_API_KEY:}
google.gemini.url=https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent
```

Khi `GEMINI_API_KEY` rỗng:

- Badge admin → "Chưa có GEMINI_API_KEY — chỉ gợi ý theo rule + DB".
- `GeminiMenuSuggestionService.suggestOrderedIds` trả `List.of()` ngay đầu hàm → `source = RULE_ENGINE`.
- Toàn bộ chức năng vẫn chạy.

---

## 11. Luồng hoạt động chi tiết

### 11.1 Khách hỏi gợi ý món

```
1. FE  → POST /api/chat { message:"gợi ý món hải sản đi", sessionId }
2. BE  ChatController → ChatService.handleMessage(...)
3. BE  Lưu USER vào chatbot_messages
4. BE  ChatMenuAssistant.tryAnswerTastyCategoryPicks → matchSeafood → list 6 món
5. BE  ChatMenuAssistant.buildMenuResponseWithLog
   5a. menuItemMapper.toResponseList(items)
   5b. AiSuggestionLogService.logSuggestion(sessionId, RULE_ENGINE, ids, title)
       → INSERT ai_suggestion_logs (session_hash=SHA256(sessionId), ...)
6. BE  Lưu BOT vào chatbot_messages
7. BE  Trả ChatResponse { reply, data:[...5 món], suggestionLogId }
8. FE  Render bubble bot + 4 thẻ món
9. Khách click 1 thẻ → POST /chat/suggestion-feedback { suggestionLogId, menuItemId }
10. BE → UPDATE ai_suggestion_logs SET accepted_menu_item_id=..., accepted_at=NOW()
```

### 11.2 Khách đặt bàn qua chat

```
1. User: "tôi muốn đặt bàn"
2. Bot:  "Anh/chị muốn đặt ngày nào ạ?"
3. User: "ngày mai 19:30 cho 4 người"
4. Bot:  "Xác nhận đặt bàn lúc 19:30 ngày 14/05/2026 cho 4 người?"
5. User: "ok"
6. BE:   - Kiểm tra dateTime không trong quá khứ
        - Kiểm tra guests ≤ 10
        - Yêu cầu user đã đăng nhập (JWT)
        - reservationService.createReservation(...)
7. Bot:  "Đặt bàn thành công!"
8. BE:   clear BookingContext khỏi BookingSessionManager
```

### 11.3 Hybrid AI rerank (khi bật Gemini)

```
1. base = AiMenuRecommendationService.recommendTop(12, excludeBeverages=true)
   (sort: rating*0.65 + soldNormalized*0.35; pinned trước)
2. Nếu cfg.geminiEnabled && có API key:
     Build prompt + gửi POST tới generativelanguage.googleapis.com
     timeout = clamp(cfg.geminiTimeoutMs, 800, 5000) ms
     parse {"ids":[...]} → lọc id ∈ base → giới hạn 5
3. Merge: id Gemini trước theo thứ tự, phần còn lại của base bám sau
4. source = HYBRID, log vào ai_suggestion_logs
```

---

## 12. Khả năng mở rộng (đề xuất nâng cấp)

| Đề xuất | Lý do |
|---|---|
| Thêm bảng/cache lưu **embedding món + vector search** | Cho phép tìm món theo ngữ nghĩa (vd. "ấm bụng buổi tối lạnh") thay vì keyword |
| Truyền **history N tin nhắn gần nhất** vào prompt Gemini | Multi-turn thực sự (hiện chỉ multi-turn ở nhánh đặt bàn) |
| Gắn cờ `intent`/`confidence` vào `chatbot_messages` | Phân tích chuyển đổi: ý định → hành vi |
| Streaming SSE/WebSocket cho câu trả lời | Trải nghiệm tốt hơn với câu dài |
| Đa ngôn ngữ (auto-detect) | Phục vụ khách nước ngoài tại QR-menu |
| Xuất `chatbot_messages` ra file (CSV/JSONL) | Phục vụ đào tạo NLU sau này |

---

## 13. Bảng đối chiếu file ↔ chức năng (cheat sheet)

| Chức năng | File |
|---|---|
| Widget chat khách (HTML) | `codefe/index/chatbot.html` |
| Widget chat khách (JS) | `codefe/index/chatbot.js` |
| Widget chat khách (CSS) | `codefe/index/chatbot.css` |
| Admin AI panel | `codefe/admin/ai.html`, `codefe/admin/ai.js`, `codefe/admin/ai.css` |
| REST endpoint chat | `restaurant-backend1/src/main/java/com/restaurant/controller/ChatController.java` |
| Orchestrator chat | `…/service/ChatService.java` |
| Rule engine menu Q&A | `…/service/ChatMenuAssistant.java` |
| Xếp hạng nội bộ | `…/ai/AiMenuRecommendationService.java` |
| Gọi Gemini | `…/ai/GeminiMenuSuggestionService.java` |
| Helper JSON id | `…/ai/AiJsonIds.java` |
| Booking context | `…/chat/BookingContext.java`, `…/chat/BookingSessionManager.java` |
| Log gợi ý | `…/service/AiSuggestionLogService.java` |
| Admin AI service/controller | `…/service/AiAdminPanelService.java`, `…/controller/AiAdminController.java` |
| Bootstrap config | `…/bootstrap/AiSystemConfigBootstrap.java` |
| Quy tắc danh mục | `…/menu/MenuCategoryRules.java` |
| Entity / Repo `chatbot_messages` | `…/entity/ChatbotMessage.java`, `…/repository/ChatbotMessageRepository.java` |
| Entity / Repo `ai_system_config` | `…/entity/AiSystemConfig.java`, `…/repository/AiSystemConfigRepository.java` |
| Entity / Repo `ai_suggestion_logs` | `…/entity/AiSuggestionLog.java`, `…/repository/AiSuggestionLogRepository.java` |
| Enum sender/source | `…/entity/enums/ChatMessageSender.java`, `…/entity/enums/AiSuggestionSource.java` |
| Migration | `…/resources/db/migration/V1.0.3__add_AI.sql`, `V20260413_2338__create_chatbot_messages.sql`, `V1.0.4__chatbot_sender_string.sql` |
| Security | `…/config/SecurityConfig.java` |
| Cấu hình ứng dụng | `…/resources/application.properties` |
| Mẫu env | `restaurant-backend1/env.example` |

---

*Tài liệu phản ánh trạng thái source code tại nhánh hiện tại. Khi thêm intent mới hoặc đổi prompt cần cập nhật lại Mục 6, 8.*

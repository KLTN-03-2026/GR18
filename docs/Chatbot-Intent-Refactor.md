# Refactor Chatbot Recommendation — Intent Dispatcher

> Tài liệu mô tả đợt sửa lớn cho chatbot AI nhằm khắc phục 11 lỗi nghiệp vụ
> (xem mục [§1 — Vấn đề cũ](#1-vấn-đề-cũ-trước-refactor)). Cập nhật cùng đợt với file
> [`Chatbot-AI-Features.md`](Chatbot-AI-Features.md) — nên đọc kèm.

---

## 1. Vấn đề cũ (trước refactor)

| # | Triệu chứng | Nguyên nhân |
|---|---|---|
| 1 | "món ngon", "đánh giá cao", "đắt tiền", "ngọt" trả gần giống nhau | Mọi intent đều rớt vào `suggestPopularDishes()` cùng pool top |
| 2 | "món ngọt" → trả Bò Wagyu, Hàu nướng, Sushi | `tryAnswerMenuQuestion` không có nhánh dessert đúng nghĩa, đi vào `suggestPopularDishes` |
| 3 | "món cay" → trả kem vani, mochi | Không có filter spicy strict; fallback về top |
| 4 | "món chay" → trả "Salad cá hồi" | Blacklist protein chưa loại "cá hồi"; còn lỗi substring `"giò"` match `"giòn"` |
| 5 | "món đắt tiền" — không sort DESC | Không có nhánh dedicated, dùng heuristic chung |
| 6 | "món rẻ tiền" — không sort ASC | Tương tự |
| 7 | Nhiều intent trùng combo món | Không diversify theo category |
| 8 | Card chat hiện "Tên món / Tên món / Giá" | `<img alt="${name}">` rò rỉ alt khi ảnh fail load |
| 9 | Phản hồi cứng nhắc | Hard-code text, không thân thiện |
| 10 | Không có fallback rõ ràng khi miss intent | `Optional.empty()` xuống nhánh default mỏng |
| 11 | `ChatMenuAssistant` ~730 dòng, intent xen lẫn | Khó test, khó mở rộng |
| Bonus | FE click thẻ món không gửi feedback đúng | `MenuItemResponse` thiếu `id` |

---

## 2. Kiến trúc mới — tách 3 tầng

```
┌──────────────────────────────────────────────────────────────────────────┐
│ IntentMatcher (chat/intent/IntentMatcher.java)                           │
│   - Pure function: String → ChatIntent (enum)                            │
│   - 19 intent có thứ tự ưu tiên rõ ràng                                  │
│   - Có negation (không cay / không ngọt) + extract price cap             │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ ChatMenuAssistant — Dispatcher                                            │
│   - `dispatch(intent, ...)` switch sang handle<X> riêng                  │
│   - Mỗi handler có business logic riêng → KHÔNG dùng chung pool          │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ IntentFilters (chat/intent/IntentFilters.java)                            │
│   - Pure filter/sort/diversify trên List<MenuItem>                       │
│   - filterDessert / filterSpicy / filterVegetarian / filterSeafood / …   │
│   - sortPriceDesc / sortPriceAsc / filterByMaxPrice                       │
│   - diversifyByCategory(limit, perCategory)                              │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ MenuKeywords (menu/MenuKeywords.java)                                     │
│ MenuCategoryRules (menu/MenuCategoryRules.java)                          │
│   - Tập keyword tập trung (whitelist/blacklist) — dễ chỉnh & test        │
│   - isDessertCategory / isBeverageCategory                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Các file đã sửa / thêm

### 3.1 Backend (`restaurant-backend1`)

| File | Loại | Mô tả |
|---|---|---|
| `chat/intent/ChatIntent.java` | **NEW** | Enum 19 intent có thứ tự ưu tiên |
| `chat/intent/IntentMatcher.java` | **NEW** | Phân loại intent thuần (no Spring/DB) |
| `chat/intent/IntentFilters.java` | **NEW** | Filter/sort/diversify thuần trên `List<MenuItem>` |
| `menu/MenuKeywords.java` | **NEW** | Tập keyword whitelist/blacklist tập trung |
| `menu/MenuCategoryRules.java` | edit | Thêm `isDessertCategory(Category)` |
| `service/ChatMenuAssistant.java` | **rewrite** | 730 → 360 dòng, intent dispatcher |
| `service/ChatService.java` | edit | Xoá gọi `tryAnswerTastyCategoryPicks`, thêm `matchCategory` |
| `dto/response/menu_items/MenuItemResponse.java` | edit | Thêm `id`, `categoryName` — FE click feedback work |
| `mapper/MenuItemMapper.java` | edit | Map `id` + `categoryName` |

### 3.2 Frontend (`codefe/index`)

| File | Mô tả |
|---|---|
| `chatbot.js` | `<img alt="" aria-hidden="true">` + lazy load để không rò rỉ alt text |
| `chatbot.css` | `.food-card img { color: transparent; font-size: 0 }` hàng rào kép |

### 3.3 Test mới (`restaurant-backend1/src/test`)

| File | Test count |
|---|---|
| `chat/intent/IntentMatcherTest.java` | 70+ assertion (parameterized) |
| `chat/intent/IntentFiltersTest.java` | 13 test cho từng filter (dessert/spicy/vegetarian/price/diversify) |

> Tổng: **83 test pass** ngay sau refactor (`./gradlew test --tests "com.restaurant.chat.intent.*"`).

---

## 4. Business logic mới — bảng intent ↔ handler

| Intent | Trigger (ví dụ) | Filter | Sort | Title trả về |
|---|---|---|---|---|
| `DESSERT` | "món ngọt", "tráng miệng", "dessert", "kem", "mochi", "chè", "bánh ngọt" | Category dessert → keyword whitelist; loại bánh mặn (bánh mì, bánh xèo…) | `bySoldThenRating` | "Tráng miệng / món ngọt được nhiều khách chọn 🍰" |
| `SPICY` | "cay", "ớt", "kimchi", "sa tế", "spicy" | Phải có whitelist + không có negation ("không cay") | `bySoldThenRating` | "Món cay / kích vị 🌶️" |
| `VEGETARIAN` | "món chay", "đồ chay", "vegan", "vegetarian" | Blacklist 50+ keyword protein + ưu tiên whitelist (đậu hũ/nấm/rau) | `bySoldThenRating` + diversify | "Lựa chọn chay / không thịt 🥗" |
| `MOST_EXPENSIVE` | "đắt nhất", "mắc nhất", "giá cao nhất", "đắt tiền" | active+available | **`sortPriceDesc`** | "Top món có giá cao nhất hiện tại 💎" |
| `CHEAPEST` | "rẻ nhất", "giá thấp nhất" | active+available | **`sortPriceAsc`** | "Top món có giá tiết kiệm nhất 💰" |
| `BUDGET` | "dưới 100k", "ngân sách 80k", "sinh viên" | `filterByMaxPrice(extractCap, fallback 120k)` | `sortPriceAsc` + diversify | "Đây là vài món có giá hợp lý được nhiều khách chọn (~Xk trở xuống) 👌" |
| `TOP_SELLING` | "bán chạy", "hay gọi", "best seller" | food-only (loại đồ uống) | `totalSold DESC` | "Top món được khách gọi nhiều nhất 🔥" |
| `TOP_RATED` | "đánh giá cao", "5 sao", "khen nhiều" | food-only | `avgRating DESC` | "Những món được đánh giá cao nhất ⭐" |
| `LOW_RATED` | "đánh giá thấp", "rating thấp", "bị chê" | food-only | `avgRating ASC` | "Một vài món có rating thấp để anh/chị cân nhắc 🤔" |
| `SUSHI` | "sushi", "sashimi", "maki", "nigiri" | keyword sushi | `bySoldThenRating` | "Sushi / sashimi đang có 🍣" |
| `SEAFOOD` | "hải sản", "seafood" | keyword tôm/cua/mực/sò/ghẹ/cá hồi… | `bySoldThenRating` | "Hải sản đang phục vụ 🦞" |
| `MEAT` | "món thịt", "steak", "ba chỉ", "wagyu" | keyword thịt/bò/heo/cừu/steak; loại há cảo/dumpling | `bySoldThenRating` | "Món thịt được nhiều khách khen 🥩" |
| `HEALTHY` | "healthy", "ít dầu", "ăn kiêng", "gym" | keyword salad/rau/luộc/hấp | `bySoldThenRating` | "Món nhẹ / ăn lành 🥗" |
| `SIGNATURE` | "signature", "đặc trưng", "nổi bật", "đặc sản" | Top weighted rating + sales | — | "Signature của quán ✨" |
| `MENU_OVERVIEW` | "menu có gì", "xem menu" | top 12, diversify 1/cat | — | "Quán đang có các nhóm: ...; Vài món tiêu biểu 📖" |
| `POPULAR_FALLBACK` | "đói", "ăn gì", "gợi ý món", "có gì ngon" | top 12 + **Gemini rerank** nếu có key | diversify 2/cat → 5 | "Vài món hot bạn có thể thích 👌" |
| `BY_CATEGORY` | tên category xuất hiện trong câu (vd "lẩu", "salad") | match category id | `bySoldThenRating` | "Món trong nhóm «X»" |
| `GREETING` | "xin chào", "hi", "hello" | — | — | (xử lý bởi ChatService) |
| `BOOKING` | "đặt bàn" | — | — | (xử lý bởi ChatService booking flow) |
| `UNKNOWN` | còn lại | — | — | Fallback friendly + gợi ý intent gần đúng |

### Diversify chi tiết

`IntentFilters.diversifyByCategory(ordered, limit, perCategory)`

- Vòng 1: duyệt theo thứ tự, mỗi category lấy tối đa `perCategory` món.
- Vòng 2: nếu chưa đủ `limit`, nới điều kiện cho phép trùng category.
- Kết quả: 2 intent khác nhau (vd MENU_OVERVIEW vs POPULAR_FALLBACK) có thể vẫn dùng cùng nguồn `recommendTop` nhưng trả ra món **khác nhau** vì khác `perCategory` (1 vs 2).

### Fallback friendly (intent UNKNOWN)

```
Em chưa rõ ý lắm. Anh/chị thử hỏi như:
• "gợi ý món ngon" — top phổ biến
• "món chay" / "món cay" / "món ngọt" — theo khẩu vị
• "món dưới 100k" — theo ngân sách
• "đặt bàn tối mai 19:30 cho 4 người" — đặt chỗ nhanh.
```

### Soft fallback (intent match nhưng filter rỗng)

Ví dụ user hỏi "có sushi không" mà bữa đó bếp hết sushi → handler không quăng UNKNOWN mà gọi `softFallback()`:

- Title custom: "Hôm nay chưa có sushi/sashimi trong thực đơn. Anh/chị thử món hải sản nóng nhé:"
- Vẫn đính kèm top 5 món phổ biến → khách không bị cảm giác "bot đuối".

---

## 5. Test cases — đầy đủ theo intent

### 5.1 IntentMatcher (`IntentMatcherTest.java`)

Mỗi câu user là 1 test case parameterized. Bảng đầy đủ:

| Intent kỳ vọng | Input ví dụ |
|---|---|
| GREETING | "xin chào", "Chào!", "hello", "hi", "hey" |
| BOOKING | "đặt bàn tối mai", "tôi muốn đặt bàn", "dat ban cho 4 người" |
| DESSERT | "có món ngọt nào không", "gợi ý món tráng miệng", "tôi muốn ăn dessert", "có kem không", "có mochi không", "bánh ngọt nào ngon", "có chè không", "tiramisu nha" |
| SPICY | "có món cay không", "kimchi nào", "ăn cái gì sa tế", "spicy food", "có món chili không" |
| VEGETARIAN | "có món chay không", "ăn chay đi", "đồ chay", "vegan menu", "vegetarian options" |
| MOST_EXPENSIVE | "món đắt nhất là gì", "top mắc nhất", "giá cao nhất", "món đắt tiền" |
| CHEAPEST | "món rẻ nhất", "giá thấp nhất" |
| BUDGET | "món dưới 100k", "tiết kiệm chút", "ngân sách 80k", "túi tiền sinh viên", "rẻ chút" |
| TOP_SELLING | "món bán chạy nhất", "món hay gọi", "best seller của quán", "top gọi nhiều nhất" |
| TOP_RATED | "món đánh giá cao", "món 5 sao", "rating cao của quán", "khen nhiều món nào" |
| LOW_RATED | "món rating thấp", "món bị chê nhất", "review thấp", "món nên tránh" |
| SUSHI | "sushi có gì", "sashimi nào ngon", "có maki không" |
| MEAT | "món thịt nào ngon", "steak nào", "ba chỉ heo" |
| POPULAR_FALLBACK | "đói quá", "có gì ngon không", "gợi ý món", "ăn gì giờ" |
| **negation** | "không cay nhé" ≠ SPICY · "không ngọt nhé" ≠ DESSERT |

Kèm 3 case cho `extractPriceCapVnd`:
- "món dưới 80k" → 80000
- "không quá 150k" → 150000
- "ngân sách 50k" → 50000

### 5.2 IntentFilters (`IntentFiltersTest.java`)

Fixture: 15 món phủ 7 category (Món chính, Hải sản, Sushi, Tráng miệng, Lẩu, Salad, Đồ uống).

| Test | Mục tiêu |
|---|---|
| `filterDessert_returnsOnlyDessertCategory` | "Món ngọt" chỉ trả Kem vani, Mochi, Tiramisu — KHÔNG trả Bò Wagyu, Hàu, Sushi |
| `filterDessert_keywordFallback_skipsSavoryBread` | Khi không có category dessert, "bánh kem dâu" được chọn, "bánh mì pate" bị loại |
| `filterSpicy_excludesNonSpicy` | Trả Lẩu thái, Kimchi, Gà sốt cay; loại Kem vani, Mochi, Sushi, Bò Wagyu |
| `filterSpicy_ignoresCasualMentionInDescription` | Description có `"không cay"` → KHÔNG match; chỉ Uramaki cá ngừ cay (có `"cay"` trong name) pass |
| `filterSpicy_descCompoundPhrasePass` | "Gà chiên giòn" có "thích cay" không pass; "Mì xào sốt cay nồng" pass; "Lẩu thái cay" pass |
| `filterVegetarian_rejectsSalmonSalad` | Loại "Salad cá hồi", "Sushi cá hồi", "Bò Wagyu", "Hàu", "Tôm hùm", "Gà sốt cay" |
| `filterVegetarian_prefersWhitelistSignal` | Trả "Salad rau xanh", "Đậu hũ chiên giòn" (không bị "giò" làm hỏng), "Nấm xào tỏi" |
| `sortPriceDesc_topIsMostExpensive` | Đầu list = "Tôm hùm 890k", thứ 2 = "Wagyu 590k" |
| `sortPriceAsc_topIsCheapest` | Đầu list = "Cà phê đen 25k" |
| `filterByMaxPrice_strict` | Cap 100k loại Tôm hùm, Wagyu, Lẩu thái |
| `diversifyByCategory_limitsPerCategory` | 5 món / 5 category khác nhau khi `perCategory=1` |
| `filterSeafood_picksSeafood` | Bắt Hàu, Tôm hùm, Sushi cá hồi, Salad cá hồi |
| `filterMeatFocused_picksMeat` | Bắt Bò Wagyu; loại Sushi cá hồi, Kem vani |
| `filterSushi_strict` | Chỉ trả "Sushi cá hồi" |

### 5.3 Tóm tắt acceptance criteria mới (theo yêu cầu)

| Yêu cầu | Kiểm chứng |
|---|---|
| (1) Tách rõ logic cho từng intent | Switch-case trong `ChatMenuAssistant.dispatch` + IntentMatcherTest |
| (2) "Món ngọt" chỉ dessert | `filterDessert_returnsOnlyDessertCategory` |
| (3) "Món cay" loại kem/mochi | `filterSpicy_excludesNonSpicy` |
| (4) "Món chay" loại "salad cá hồi" | `filterVegetarian_rejectsSalmonSalad` |
| (5) "Đắt tiền" sort DESC | `sortPriceDesc_topIsMostExpensive` |
| (6) "Rẻ tiền" sort ASC + available only | `sortPriceAsc_topIsCheapest` + `filterByMaxPrice_strict` + `IntentFilters.onlyAvailable` |
| (7) Diversify | `diversifyByCategory_limitsPerCategory` |
| (8) FE không duplicate title | `chatbot.js`: `alt=""` + `aria-hidden`; `chatbot.css`: `color: transparent; font-size: 0` |
| (9) Natural response | Title mới có emoji + cụm thân thiện ("👌", "🍰", "🌶️"…) |
| (10) Fallback friendly | `friendlyFallback()` + `softFallback()` |
| (11) Tách intent rõ ràng | Enum `ChatIntent` + `IntentMatcher` + dispatcher |

---

## 5.5 Hot-fix v3 — Food vs Beverage context cho CHEAPEST / BUDGET

### Triệu chứng
User gõ `"món rẻ"` → bot trả Nước suối / Coca / Pepsi / 7Up. Đúng là rẻ nhất, nhưng sai kỳ vọng — khách hỏi "món ăn", không phải đồ uống.

### Quy tắc mới
1. **`IntentMatcher.isFoodIntent(msg)`** — match `"món"`, `"đồ ăn"`, `"thức ăn"`, `"ăn"`, `"đói"`, `"food"`, `"dish"`.
2. **`IntentMatcher.isBeverageIntent(msg)`** — match `"đồ uống / thức uống / nước uống / nước / uống / drink / beverage / cà phê / trà / sinh tố / coca / pepsi / 7up / sting / nước suối / nước ngọt …"`.
3. **`IntentMatcher.shouldExcludeBeverages(intent, msg)`**:
   - Beverage hint + KHÔNG food hint → **false** (giữ đồ uống) → explicit "nước rẻ".
   - Food hint + KHÔNG beverage hint → **true** (loại đồ uống) → explicit "món rẻ".
   - Mơ hồ (chỉ "rẻ nhất") + intent ∈ {CHEAPEST, BUDGET} → **true** (food-first bias).
   - Mơ hồ + intent khác → **false**.
4. **`IntentFilters.excludeBeverages` / `onlyBeverages`** — split pool theo `MenuCategoryRules.isBeverageCategory`.
5. **`IntentFilters.foodFirstThenBeverages(ordered, limit)`** — composer: lấy food trước, nếu thiếu mới điền beverage cuối list.

### Handler mới

| Intent | Câu user | Flow |
|---|---|---|
| CHEAPEST | "món rẻ nhất" / "rẻ nhất" / "món ăn rẻ nhất" | excludeBeverages → sortPriceAsc → top 5; title "Top **món ăn** có giá tiết kiệm nhất 💰" |
| CHEAPEST | "nước rẻ nhất" / "đồ uống rẻ nhất" / "cà phê rẻ nhất" | onlyBeverages → sortPriceAsc → top 5; title "Đồ uống có giá tiết kiệm nhất 🥤" |
| BUDGET | "món dưới 80k" / "món rẻ" / "tiết kiệm chút" | filterByMaxPrice → food-only diversify; thiếu mới `foodFirstThenBeverages` điền nốt; title "Đây là món ăn ~80k trở xuống 👌" |
| BUDGET | "nước dưới 30k" / "đồ uống rẻ" | filterByMaxPrice → onlyBeverages → diversify; title "Đây là đồ uống ~30k trở xuống 🥤" |

### Before / After

| Câu user | Trước (sai) | Sau (đúng) |
|---|---|---|
| `món rẻ` | Nước suối · Coca · Pepsi · 7Up · Cà phê | Bánh flan · Bún chả · Cơm gà · Mì xào · … |
| `món ăn rẻ nhất` | Coca · Pepsi · 7Up | Bánh flan · Bún chả · Cơm gà |
| `món dưới 80k` | Lẫn beverage trong top | Toàn food, chỉ điền beverage nếu food < 5 |
| `nước rẻ` | (giữ nguyên) | Nước suối · Coca · Pepsi · 7Up · Cà phê |
| `đồ uống rẻ nhất` | (giữ nguyên) | Đồ uống sort ASC, title 🥤 |

### Test coverage
- `IntentMatcherTest`: thêm `isFoodIntent_true/false`, `isBeverageIntent_true/false`, `shouldExcludeBeverages_decisionMatrix` (12 cặp intent×msg). CHEAPEST mở rộng thêm `"món ăn rẻ nhất"` & `"nước rẻ nhất"`. BUDGET mở rộng `"món rẻ"`, `"món ăn rẻ"`, `"nước rẻ"`, `"đồ uống rẻ"`.
- `IntentFiltersTest`: thêm fixture `foodBeveragePool()` (5 food + 5 beverage) cùng 6 test mới:
  - `excludeBeverages_dropsAllDrinks`
  - `onlyBeverages_keepsDrinksOnly`
  - `cheapest_foodIntent_excludesBeverages` — "món ăn rẻ nhất" KHÔNG có Coca/Pepsi
  - `cheapest_beverageIntent_keepsBeverages` — "đồ uống rẻ nhất" được Coca/Pepsi
  - `budget_foodIntent_excludesBeverages` — "món dưới 80k" toàn food
  - `budget_beverageIntent_keepsBeverages` — "nước rẻ" → beverage flow
  - `foodFirstThenBeverages_fillsOnlyIfShort` — composer chỉ điền beverage khi food < limit

---

## 5.4 Hot-fix v2 — Name-first matching (chống false-positive)

Trong môi trường production phát hiện: với input `"món cay"`, FE vẫn nhận **Bò Wagyu, Kem vani, Mochi** kèm Uramaki cá ngừ cay. Nguyên nhân: description thật của một số món chứa từ `"cay"` trong cụm casual (vd. `"không cay, phù hợp trẻ em"`) — filter cũ dùng `blob(m).contains("cay")` không phân biệt ngữ cảnh.

**Cách fix:**

- `MenuKeywords` tách `SPICY_NAME_KEYS` (match trên NAME) và `SPICY_DESC_COMPOUNDS` (chỉ accept cụm rõ ràng "sốt cay", "cay nồng", "vị cay"…). Tương tự cho `DESSERT_NAME_KEYS`.
- `IntentFilters.filterSpicy` đổi sang quy tắc:
  1. Negation ở name HOẶC description → loại ngay.
  2. NAME chứa keyword cay → pass.
  3. Description chứa compound cay → pass.
  4. Còn lại → loại (single mention "cay" trong desc KHÔNG đủ tin cậy).
- Áp dụng cùng nguyên lý (`nameLower(m)`) cho `filterDessert`, `filterSeafood`, `filterMeatFocused`, `filterSushi`, `filterHealthy` → đều high-precision.
- Thêm `log.debug("[chat][SPICY] picks=...")` để trace production data khi cần.

Test mới ghim đúng kịch bản: `filterSpicy_ignoresCasualMentionInDescription` mô phỏng data Wagyu/Kem/Mochi/Uramaki như báo cáo của user — chỉ Uramaki được trả.

---

## 6. Tương thích ngược

- `ChatMenuAssistant.isStandaloneGreeting(String)` giữ nguyên signature (static) — `ChatService` không phải sửa.
- `ChatMenuAssistant.tryAnswerMenuQuestion(...)` giữ signature, trả `Optional<ChatResponse>` như cũ.
- `ChatMenuAssistant.suggestPopularDishes(...)` giữ signature; vẫn dùng AiSystemConfig, vẫn log vào `ai_suggestion_logs`, vẫn rerank Gemini khi đủ điều kiện.
- `ChatMenuAssistant.tryAnswerTastyCategoryPicks(...)` được đánh dấu `@Deprecated` + ủy quyền tới `tryAnswerMenuQuestion` (đảm bảo không phá hợp đồng cũ nếu có chỗ khác gọi).
- `MenuItemResponse` thêm field `id`, `categoryName` — **non-breaking** với các consumer cũ (chỉ thêm field, không đổi tên).
- API endpoint `/api/chat`, `/api/chat/suggestion-feedback` không đổi.

---

## 7. Kế hoạch test thủ công (smoke)

Chạy app: `./gradlew bootRun -Pkill8080`. Mở `index.html` + chatbot, gõ các câu sau và xác nhận:

| Câu gõ | Kết quả mong đợi |
|---|---|
| `gợi ý món ngon` | Title có emoji 👌, 5 món đa dạng category |
| `món đắt nhất` | Món đầu tiên có giá cao nhất (xem sticker giá) |
| `món rẻ nhất` | Món đầu tiên có giá thấp nhất |
| `món dưới 80k` | Tất cả món ≤ 80k, diversify category |
| `món ngọt` | CHỈ trả tráng miệng (kem/mochi/bánh ngọt/tiramisu/chè); KHÔNG trả wagyu/hàu/sushi |
| `món cay` | CHỈ trả món có "cay/ớt/kimchi/sa tế"; KHÔNG trả kem/mochi |
| `món chay` | KHÔNG trả "salad cá hồi", KHÔNG trả "sushi", KHÔNG trả món có thịt/hải sản |
| `đánh giá cao` | Sort theo avgRating DESC |
| `đánh giá thấp` | Sort theo avgRating ASC |
| `bán chạy` | Sort theo totalSold DESC |
| `sushi có gì` | Chỉ sushi/sashimi/maki/nigiri |
| `signature` / `đặc trưng` | Trả mix top theo trọng số rating/sales |
| `tôi muốn ăn xôi gấc` (intent lạ) | Trả `friendlyFallback()` với 4 gợi ý intent |
| `xin chào` | Không phá flow (GREETING vẫn được `ChatService` xử lý) |
| `đặt bàn 19:30 mai 4 người` | Vào nhánh booking flow (giữ nguyên) |

---

## 8. Lưu ý / debt còn lại

- **Không dùng word boundary** trong `containsAny` (hiện chỉ `String.contains`). Nếu dataset thêm món có tên gây va chạm substring, cần nâng cấp sang regex `\b...\b` (nhưng phức tạp với tiếng Việt có dấu). Hiện đã rà keyword tránh các đơn âm rủi ro nhất.
- Chưa truyền **history N tin nhắn** vào prompt Gemini (mỗi lượt vẫn stateless). Có thể nâng cấp sau bằng cách đọc `ChatbotMessageRepository.findTop20BySessionIdOrderByCreatedAtDesc` rồi đính kèm.
- `IntentFilters.onlyAvailable` thêm sẵn — hiện pool đã được repo lọc, dùng làm hàng rào kép khi tích hợp endpoint công khai khác.
- Test mới là **unit-level** (no Spring) — cần thêm test mức service nếu muốn cover full flow (mock `MenuItemRepository` etc.). Đề xuất file `ChatMenuAssistantIntegrationTest` ở sprint sau.

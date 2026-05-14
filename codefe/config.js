// ============================================================
// Auto-switch API base URL theo môi trường (local vs production).
// File này PHẢI được load TRƯỚC mọi script gọi API khác.
// ============================================================
const API_BASE =
    window.location.hostname === "localhost"
        ? "http://localhost:8080/api"
        : "https://157-66-219-65.sslip.io/api";

window.API_BASE = API_BASE;
// Backward-compat: một số script cũ có thể vẫn đọc RESTAURANT_API_BASE.
// qr-session.js có thể ghi đè bằng localStorage["restaurant_api_base"] để dev test backend khác.
window.RESTAURANT_API_BASE = API_BASE;

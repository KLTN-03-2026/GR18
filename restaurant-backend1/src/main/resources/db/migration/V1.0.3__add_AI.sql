-- ============================================================
-- BẢNG 12: chatbot_messages - AI-Powered Conversation History
-- ============================================================
CREATE TABLE IF NOT EXISTS chatbot_messages (
                                                id             BIGINT AUTO_INCREMENT PRIMARY KEY,
                                                user_id        BIGINT NULL,
                                                menu_item_id   BIGINT NULL,          -- Liên kết món ăn AI gợi ý
                                                session_id     VARCHAR(255) NOT NULL, -- Quản lý ngữ cảnh (Context)
                                                sender         ENUM('USER','BOT') NOT NULL,
                                                message        TEXT NOT NULL,
                                                intent         VARCHAR(100),         -- Ý định khách hàng (order, recommend, complain)
                                                confidence     DOUBLE,               -- Độ tin cậy của model AI
                                                metadata       JSON NULL,            -- Lưu keywords, recommended_list, v.v.
                                                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc khóa ngoại
                                                CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                                                CONSTRAINT fk_chat_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ============================================================
-- TỐI ƯU HÓA: Advanced Indexing
-- ============================================================

-- Index 1: Thống kê các yêu cầu phổ biến (Analytics)
CREATE INDEX idx_chat_intent ON chatbot_messages(intent);

-- Index 2: Composite Index giúp load lịch sử chat theo session cực nhanh (Production-level)
-- Tối ưu cho câu lệnh: WHERE session_id = ? ORDER BY created_at DESC
CREATE INDEX idx_chat_session_time ON chatbot_messages(session_id, created_at);

-- Index 3: Tìm kiếm tin nhắn theo thời gian (Report)
CREATE INDEX idx_chat_created_at ON chatbot_messages(created_at);
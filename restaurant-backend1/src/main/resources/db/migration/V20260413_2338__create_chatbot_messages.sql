CREATE TABLE IF NOT EXISTS chatbot_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    menu_item_id BIGINT NULL,
    session_id VARCHAR(255) NOT NULL,
    sender VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    intent VARCHAR(100) NULL,
    confidence DOUBLE NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chatbot_messages_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_chatbot_messages_menu_item
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_chatbot_messages_session_created_at
    ON chatbot_messages(session_id, created_at);

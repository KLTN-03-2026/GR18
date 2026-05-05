-- JPA map ChatbotMessage.sender sang String/VARCHAR; ENUM MySQL khiến hibernate ddl-auto=validate lệch kiểu.
ALTER TABLE chatbot_messages
    MODIFY COLUMN sender VARCHAR(20) NOT NULL;

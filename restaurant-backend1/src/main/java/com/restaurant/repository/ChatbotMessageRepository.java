package com.restaurant.repository;

import com.restaurant.entity.ChatbotMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatbotMessageRepository extends JpaRepository<ChatbotMessage, Long> {

    List<ChatbotMessage> findTop20BySessionIdOrderByCreatedAtDesc(String sessionId);
}

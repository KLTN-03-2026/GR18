package com.restaurant.repository;

import com.restaurant.entity.AiSuggestionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiSuggestionLogRepository extends JpaRepository<AiSuggestionLog, Long> {

    long countByAcceptedMenuItemIdIsNotNull();

    @Query("SELECT l.source, COUNT(l) FROM AiSuggestionLog l GROUP BY l.source")
    List<Object[]> countGroupedBySource();

    List<AiSuggestionLog> findTop100ByOrderByCreatedAtDesc();
}

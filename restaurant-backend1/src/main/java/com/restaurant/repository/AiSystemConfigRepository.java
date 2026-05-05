package com.restaurant.repository;

import com.restaurant.entity.AiSystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AiSystemConfigRepository extends JpaRepository<AiSystemConfig, Long> {
}

package com.restaurant.bootstrap;

import com.restaurant.entity.AiSystemConfig;
import com.restaurant.repository.AiSystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khởi tạo một dòng cấu hình AI (id = 1).
 */
@Component
@Order(50)
@RequiredArgsConstructor
public class AiSystemConfigBootstrap implements ApplicationRunner {

    private final AiSystemConfigRepository repository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!repository.existsById(AiSystemConfig.SINGLETON_ID)) {
            repository.save(AiSystemConfig.builder()
                    .id(AiSystemConfig.SINGLETON_ID)
                    .aiEnabled(true)
                    .geminiEnabled(true)
                    .pinnedMenuItemIdsJson("[]")
                    .restrictCategoryIdsJson("[]")
                    .historyLookbackDays(90)
                    .ratingWeight(0.65)
                    .salesWeight(0.35)
                    .geminiTimeoutMs(2800)
                    .anonymizeAnalytics(true)
                    .build());
        }
    }
}

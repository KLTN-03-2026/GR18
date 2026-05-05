package com.restaurant.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Khi sua noi dung file migration da duoc apply, Flyway bao checksum mismatch.
 * Bat tam thoi {@code app.flyway.repair-before-migrate=true}, chay app mot lan
 * (repair dong bo checksum), roi tat lai. Khong nen de true tren production.
 */
@Configuration
@ConditionalOnProperty(name = "app.flyway.repair-before-migrate", havingValue = "true")
public class FlywayRepairConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return (Flyway flyway) -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}

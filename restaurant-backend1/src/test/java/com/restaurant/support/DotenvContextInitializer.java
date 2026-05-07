package com.restaurant.support;

import io.github.cdimascio.dotenv.Dotenv;
import java.util.HashMap;
import java.util.Map;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;

/** Nạp biến từ {@code .env} (thư mục làm việc) vào {@code Environment} — dùng cho integration test. */
public class DotenvContextInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        try {
            Dotenv dotenv =
                    Dotenv.configure().directory(".").ignoreIfMalformed().ignoreIfMissing().load();
            Map<String, Object> map = new HashMap<>();
            dotenv.entries().forEach(entry -> map.put(entry.getKey(), entry.getValue()));
            if (!map.isEmpty()) {
                applicationContext.getEnvironment().getPropertySources().addFirst(new MapPropertySource("dotenv", map));
            }
        } catch (Exception ignored) {
            // Không có .env: test vẫn chạy (có thể bị assumeTrue bỏ qua)
        }
    }
}

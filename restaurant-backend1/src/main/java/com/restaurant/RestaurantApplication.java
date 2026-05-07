package com.restaurant;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.util.StringUtils;

@SpringBootApplication
@EnableAsync
public class RestaurantApplication {

    /**
     * Nạp biến từ file .env trong thư mục làm việc (GIT đã ignore). Không ghi đè biến môi trường/OS đã có.
     */
    private static void loadDotenvIntoSystemPropertiesIfUnset() {
        try {
            Dotenv dotenv =
                    Dotenv.configure().directory(".").ignoreIfMalformed().ignoreIfMissing().load();
            dotenv
                    .entries()
                    .forEach(
                            entry -> {
                                String key = entry.getKey();
                                String value = entry.getValue();
                                if (!StringUtils.hasText(value)
                                        || StringUtils.hasText(System.getenv(key))
                                        || StringUtils.hasText(System.getProperty(key))) {
                                    return;
                                }
                                System.setProperty(key, value);
                            });
        } catch (Exception ignored) {
            // Không có .env vẫn chạy bình thường
        }
    }

    public static void main(String[] args) {
        loadDotenvIntoSystemPropertiesIfUnset();
        SpringApplication.run(RestaurantApplication.class, args);
    }
}

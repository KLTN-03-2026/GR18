package com.restaurant.config;

import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Engine Thymeleaf chỉ dùng cho nội dung email (tách khỏi view MVC nếu có).
 */
@Configuration
public class EmailThymeleafConfig {

    public static final String EMAIL_TEMPLATE_ENGINE = "emailTemplateEngine";

    @Bean(name = EMAIL_TEMPLATE_ENGINE)
    public SpringTemplateEngine emailTemplateEngine() {
        SpringTemplateEngine engine = new SpringTemplateEngine();
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/mail/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCacheable(true);
        resolver.setCheckExistence(true);
        engine.setTemplateResolver(resolver);
        return engine;
    }
}

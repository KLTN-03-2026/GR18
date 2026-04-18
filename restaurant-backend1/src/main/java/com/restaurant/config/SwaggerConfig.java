package com.restaurant.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("🍽️ QR Restaurant API")
                        .description("""
                                ## Hệ thống API cho Website Đặt Bàn & Gọi Món bằng Mã QR
                                
                                ### Tính năng chính:
                                - **Auth**: Đăng ký, Đăng nhập (JWT), OAuth2 (Google/Facebook)
                                - **Menu**: Xem danh sách, tìm kiếm, lọc theo danh mục
                                - **QR Order**: Quét QR → Gọi món (không cần đăng nhập)
                                - **Reservation**: Đặt bàn trực tuyến (cần đăng nhập)
                                - **Order**: Quản lý đơn hàng, theo dõi trạng thái realtime
                                - **Payment**: Thanh toán tiền mặt / QR chuyển khoản
                                - **AI Recommendation**: Gợi ý món ăn thông minh
                                - **Admin**: Quản lý bàn, menu, nhân viên, báo cáo doanh thu
                                
                                ### Phân quyền:
                                - `CUSTOMER`: Khách hàng đăng nhập
                                - `STAFF`: Nhân viên nhà hàng
                                - `ADMIN`: Quản trị viên
                                - *Public*: Không cần token (menu, QR scan)
                                """)
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Group 18 - ĐH Duy Tân")
                                .email("phuocloi100204@gmail.com"))
                        .license(new License().name("MIT License"))
                )
                .servers(List.of(
                        new Server().url("http://localhost:8080/api").description("Local Development"),
                        new Server().url("https://api.restaurant.com").description("Production")
                ))
                // JWT Security Scheme cho Swagger UI
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .name("bearerAuth")
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Nhập Access Token vào đây. Ví dụ: eyJhbGci...")
                        )
                );
    }
}

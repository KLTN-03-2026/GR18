# Multi-stage image: Gradle build + JRE chạy Spring Boot (Java 22).
# Cần MySQL (hoặc DB_URL tương thích) qua biến môi trường khi chạy container.
#
# Ví dụ build:
#   docker build -t restaurant-backend .
# Ví dụ chạy (MySQL trên máy host, Windows/Mac):
#   docker run --rm -p 8080:8080 ^
#     -e DB_URL="jdbc:mysql://host.docker.internal:3306/restaurant_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=Asia/Ho_Chi_Minh&allowPublicKeyRetrieval=true&characterEncoding=UTF-8" ^
#     -e DB_USERNAME=root -e DB_PASSWORD=secret -e JWT_SECRET=change-me ^
#     restaurant-backend

FROM eclipse-temurin:22-jdk-noble AS build
WORKDIR /app

COPY gradlew gradlew.bat ./
COPY gradle ./gradle
COPY build.gradle settings.gradle ./
COPY src ./src

RUN chmod +x gradlew && ./gradlew bootJar --no-daemon \
    && for f in build/libs/restaurant-backend-*.jar; do \
         case "$f" in (*-plain.jar) ;; (*) cp "$f" /app/app.jar; break ;; esac; \
       done

FROM eclipse-temurin:22-jre-noble

RUN groupadd --system spring && useradd --system spring -g spring \
    && mkdir /data && mkdir -p /opt/app \
    && chown -R spring:spring /data

COPY --from=build /app/app.jar /opt/app/application.jar

USER spring:spring
WORKDIR /data
EXPOSE 8080

ENV JAVA_OPTS=""
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar /opt/app/application.jar"]

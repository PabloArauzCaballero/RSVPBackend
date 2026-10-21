# Build from the repository root: docker build -f apps/identity-service/Dockerfile .
FROM eclipse-temurin:21.0.8_9-jdk-noble AS build
WORKDIR /src
COPY apps/identity-service/gradlew apps/identity-service/settings.gradle.kts apps/identity-service/build.gradle.kts ./
COPY apps/identity-service/gradle ./gradle
RUN chmod +x gradlew && ./gradlew --no-daemon --console=plain dependencies > /dev/null
COPY apps/identity-service/src ./src
RUN ./gradlew --no-daemon --console=plain bootJar

FROM eclipse-temurin:21.0.8_9-jre-noble
RUN useradd --system --uid 10001 identity
WORKDIR /app
COPY --from=build /src/build/libs/identity-service.jar ./identity-service.jar
USER identity
EXPOSE 8080
# bash /dev/tcp avoids shipping curl or wget in the runtime image.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=10 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /health HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 && head -n 1 <&3 | grep -q " 200 "'
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/identity-service.jar"]

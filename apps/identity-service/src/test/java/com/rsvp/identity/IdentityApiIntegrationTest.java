package com.rsvp.identity;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Real HTTP against the Spring Boot app, with Postgres and Redis in containers. Tokens are
 * verified with keys read from the served JWKS, exactly as consuming services do.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "identity.password.bcrypt-strength=4")
class IdentityApiIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.6-alpine3.22").withDatabaseName("identity_db");
    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:8.2.1-alpine3.22").withExposedPorts(6379);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.data.redis.url", () -> "redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
    }

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PASSWORD = "a long enough passphrase";
    private final HttpClient http = HttpClient.newHttpClient();

    @LocalServerPort int port;
    @Autowired JdbcClient jdbc;

    record Reply(int status, JsonNode body, HttpResponse<String> raw) { }

    private Reply call(String method, String path, Object body, Map<String, String> headers) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        headers.forEach(builder::header);
        if (body == null) builder.method(method, HttpRequest.BodyPublishers.noBody());
        else builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body instanceof String raw ? raw : JSON.writeValueAsString(body)));
        var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return new Reply(response.statusCode(), response.body().isEmpty() ? null : JSON.readTree(response.body()), response);
    }

    private Reply post(String path, Object body) throws Exception { return call("POST", path, body, Map.of()); }

    private static String uniqueEmail() { return "user-" + UUID.randomUUID() + "@example.test"; }

    private static JsonNode claims(String token) throws Exception {
        return JSON.readTree(new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8));
    }

    /** Verifies a token with the key from GET /.well-known/jwks.json, independent of the service code. */
    private boolean verifiesAgainstJwks(String token) throws Exception {
        var header = JSON.readTree(Base64.getUrlDecoder().decode(token.split("\\.")[0]));
        var keys = call("GET", "/.well-known/jwks.json", null, Map.of()).body().get("keys");
        for (var key : keys) {
            if (!key.get("kid").asText().equals(header.get("kid").asText())) continue;
            var n = new BigInteger(1, Base64.getUrlDecoder().decode(key.get("n").asText()));
            var e = new BigInteger(1, Base64.getUrlDecoder().decode(key.get("e").asText()));
            var publicKey = KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(n, e));
            var verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(publicKey);
            var parts = token.split("\\.");
            verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            return verifier.verify(Base64.getUrlDecoder().decode(parts[2]));
        }
        return false;
    }

    @Test
    void registerThenLoginIssuesAVerifiableTokenWithRolesAndOrganizations() throws Exception {
        var email = uniqueEmail();
        var registered = post("/auth/register", Map.of("email", email.toUpperCase(), "password", PASSWORD));
        assertThat(registered.status()).isEqualTo(201);
        assertThat(registered.body().get("email").asText()).isEqualTo(email);
        assertThat(registered.body().get("roles").toString()).isEqualTo("[\"HOST\"]");
        assertThat(registered.body().has("password")).isFalse();
        assertThat(registered.raw().headers().firstValue("Location")).hasValueSatisfying(location -> assertThat(location).endsWith(registered.body().get("id").asText()));
        // Sign-up signs the user in, matching the frontend IdentityClient.register contract.
        assertThat(registered.body().get("expiresIn").asLong()).isEqualTo(900);
        assertThat(verifiesAgainstJwks(registered.body().get("accessToken").asText())).isTrue();
        assertThat(post("/auth/refresh", Map.of("refreshToken", registered.body().get("refreshToken").asText())).status()).isEqualTo(200);

        var login = post("/auth/login", Map.of("email", email, "password", PASSWORD));
        assertThat(login.status()).isEqualTo(200);
        assertThat(login.raw().headers().firstValue("Cache-Control")).hasValueSatisfying(value -> assertThat(value).contains("no-store"));
        assertThat(login.body().get("tokenType").asText()).isEqualTo("Bearer");
        assertThat(login.body().get("expiresIn").asLong()).isEqualTo(900);
        var access = login.body().get("accessToken").asText();
        assertThat(verifiesAgainstJwks(access)).isTrue();
        var claims = claims(access);
        assertThat(claims.get("sub").asText()).isEqualTo(registered.body().get("id").asText());
        assertThat(claims.get("roles").toString()).isEqualTo("[\"HOST\"]");
        assertThat(claims.get("organizationIds").toString()).isEqualTo("[]");
        assertThat(claims.get("exp").asLong() - claims.get("iat").asLong()).isEqualTo(900);
        assertThat(claims.get("exp").asLong()).isGreaterThan(Instant.now().getEpochSecond());

        // A planner membership granted after login reaches the next token on refresh (REQ-07-06 claim shape).
        var userId = UUID.fromString(registered.body().get("id").asText());
        var organization = UUID.randomUUID();
        jdbc.sql("INSERT INTO organization (id, name, owner_user_id) VALUES (:id, 'Bodas Andinas', :owner)").param("id", organization).param("owner", userId).update();
        jdbc.sql("INSERT INTO organization_member (organization_id, user_id, role) VALUES (:org, :user, 'PLANNER')").param("org", organization).param("user", userId).update();
        var refreshed = post("/auth/refresh", Map.of("refreshToken", login.body().get("refreshToken").asText()));
        assertThat(refreshed.status()).isEqualTo(200);
        var plannerClaims = claims(refreshed.body().get("accessToken").asText());
        assertThat(plannerClaims.get("roles").toString()).isEqualTo("[\"HOST\",\"PLANNER\"]");
        assertThat(plannerClaims.get("organizationIds").toString()).isEqualTo("[\"" + organization + "\"]");
        assertThat(verifiesAgainstJwks(refreshed.body().get("accessToken").asText())).isTrue();
    }

    @Test
    void registrationRejectsDuplicatesAndInvalidInput() throws Exception {
        var email = uniqueEmail();
        assertThat(post("/auth/register", Map.of("email", email, "password", PASSWORD)).status()).isEqualTo(201);
        var duplicate = post("/auth/register", Map.of("email", " " + email.toUpperCase() + " ", "password", PASSWORD));
        assertThat(duplicate.status()).isEqualTo(409);
        assertThat(duplicate.raw().headers().firstValue("Content-Type")).hasValueSatisfying(type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(duplicate.body().get("status").asInt()).isEqualTo(409);

        var weak = post("/auth/register", Map.of("email", uniqueEmail(), "password", "short"));
        assertThat(weak.status()).isEqualTo(422);
        assertThat(weak.body().get("errors").get(0).get("field").asText()).isEqualTo("password");
        assertThat(weak.body().toString()).doesNotContain("short");

        assertThat(post("/auth/register", Map.of("email", "nope", "password", PASSWORD)).status()).isEqualTo(422);
        assertThat(post("/auth/register", "{not json").status()).isEqualTo(422);
        assertThat(post("/auth/register", Map.of()).status()).isEqualTo(422);
    }

    @Test
    void signUpRoleIsSelfServiceOnly() throws Exception {
        var planner = post("/auth/register", Map.of("email", uniqueEmail(), "password", PASSWORD, "role", "PLANNER"));
        assertThat(planner.status()).isEqualTo(201);
        assertThat(claims(planner.body().get("accessToken").asText()).get("roles").toString()).isEqualTo("[\"PLANNER\"]");
        assertThat(claims(planner.body().get("accessToken").asText()).get("organizationIds").toString()).isEqualTo("[]");
        assertThat(post("/auth/register", Map.of("email", uniqueEmail(), "password", PASSWORD, "role", "PROVIDER")).status()).isEqualTo(201);

        var adminEmail = uniqueEmail();
        var admin = post("/auth/register", Map.of("email", adminEmail, "password", PASSWORD, "role", "ADMIN"));
        assertThat(admin.status()).isEqualTo(422);
        assertThat(admin.body().get("errors").get(0).get("field").asText()).isEqualTo("role");
        assertThat(post("/auth/login", Map.of("email", adminEmail, "password", PASSWORD)).status()).as("rejected sign-up persisted nothing").isEqualTo(401);
        assertThat(post("/auth/register", Map.of("email", uniqueEmail(), "password", PASSWORD, "role", "GUEST")).status()).isEqualTo(422);
    }

    @Test
    void loginFailuresAreIndistinguishable() throws Exception {
        var email = uniqueEmail();
        post("/auth/register", Map.of("email", email, "password", PASSWORD));
        var wrongPassword = post("/auth/login", Map.of("email", email, "password", "not the right passphrase"));
        var unknownUser = post("/auth/login", Map.of("email", uniqueEmail(), "password", PASSWORD));
        var malformed = post("/auth/login", Map.of("email", "nope", "password", PASSWORD));
        for (var reply : new Reply[] { wrongPassword, unknownUser, malformed }) {
            assertThat(reply.status()).isEqualTo(401);
            assertThat(reply.body().get("title").asText()).isEqualTo("Authentication failed");
            assertThat(reply.body().has("accessToken")).isFalse();
        }
    }

    /** REQ-07-03 over HTTP and Redis: reuse revokes the chain; logout is idempotent. */
    @Test
    void refreshRotationReuseAndLogout() throws Exception {
        var email = uniqueEmail();
        post("/auth/register", Map.of("email", email, "password", PASSWORD));
        var first = post("/auth/login", Map.of("email", email, "password", PASSWORD)).body().get("refreshToken").asText();
        var second = post("/auth/refresh", Map.of("refreshToken", first));
        assertThat(second.status()).isEqualTo(200);
        var secondToken = second.body().get("refreshToken").asText();
        assertThat(secondToken).isNotEqualTo(first);

        assertThat(post("/auth/refresh", Map.of("refreshToken", first)).status()).as("reuse").isEqualTo(401);
        assertThat(post("/auth/refresh", Map.of("refreshToken", secondToken)).status()).as("chain revoked").isEqualTo(401);

        var other = post("/auth/login", Map.of("email", email, "password", PASSWORD)).body().get("refreshToken").asText();
        assertThat(post("/auth/logout", Map.of("refreshToken", other)).status()).isEqualTo(204);
        assertThat(post("/auth/logout", Map.of("refreshToken", other)).status()).isEqualTo(204);
        assertThat(post("/auth/refresh", Map.of("refreshToken", other)).status()).isEqualTo(401);
        assertThat(post("/auth/logout", Map.of("refreshToken", "short")).status()).isEqualTo(422);
        assertThat(post("/auth/refresh", Map.of("refreshToken", "x".repeat(64))).status()).isEqualTo(401);
    }

    @Test
    void publicEndpointsAndCorrelation() throws Exception {
        assertThat(call("GET", "/health", null, Map.of()).status()).isEqualTo(200);
        var jwks = call("GET", "/.well-known/jwks.json", null, Map.of());
        assertThat(jwks.status()).isEqualTo(200);
        var key = jwks.body().get("keys").get(0);
        assertThat(key.get("alg").asText()).isEqualTo("RS256");
        assertThat(key.has("d")).as("private exponent never published").isFalse();

        var correlated = call("POST", "/auth/login", Map.of("email", uniqueEmail(), "password", PASSWORD), Map.of("X-Correlation-Id", "abc-123#7"));
        assertThat(correlated.raw().headers().firstValue("X-Correlation-Id")).hasValue("abc-123#7");
        assertThat(correlated.body().get("correlationId").asText()).isEqualTo("abc-123#7");

        assertThat(post("/auth/password-recovery", Map.of("email", uniqueEmail())).status()).isEqualTo(202);
        assertThat(post("/auth/password-recovery", Map.of("email", "nope")).status()).isEqualTo(422);
    }
}

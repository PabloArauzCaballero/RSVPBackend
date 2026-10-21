package com.rsvp.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rsvp.identity.application.PasswordRecoveryService;
import com.rsvp.identity.application.RefreshTokenRotation;
import com.rsvp.identity.application.Rs256JwtService;
import com.rsvp.identity.application.UnauthorizedException;
import com.rsvp.identity.domain.AccessGrant;
import com.rsvp.identity.domain.EmailAddress;
import com.rsvp.identity.domain.InvalidInputException;
import com.rsvp.identity.domain.OrganizationMember;
import com.rsvp.identity.domain.PasswordPolicy;
import com.rsvp.identity.domain.Permission;
import com.rsvp.identity.domain.Role;
import com.rsvp.identity.domain.User;
import com.rsvp.identity.infrastructure.InMemoryRefreshTokenRepository;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class DomainAndApplicationTest {
    private final User host = User.selfRegistered(UUID.randomUUID(), new EmailAddress("Host@Example.test "));

    @Test
    void emailIsNormalizedAndValidated() {
        assertThat(host.email().value()).isEqualTo("host@example.test");
        assertThatThrownBy(() -> new EmailAddress("not-an-email")).isInstanceOf(InvalidInputException.class);
        assertThatThrownBy(() -> new EmailAddress(null)).isInstanceOf(InvalidInputException.class);
    }

    @Test
    void passwordPolicyIsLengthBased() {
        PasswordPolicy.check("correct horse battery");
        assertThatThrownBy(() -> PasswordPolicy.check("short")).isInstanceOf(InvalidInputException.class);
        assertThatThrownBy(() -> PasswordPolicy.check("x".repeat(129))).isInstanceOf(InvalidInputException.class);
    }

    @Test
    void selfRegistrationNeverGrantsAdmin() {
        assertThat(host.roles()).containsExactly(Role.HOST);
        assertThat(User.selfRegistered(UUID.randomUUID(), host.email(), null).roles()).containsExactly(Role.HOST);
        assertThat(User.selfRegistered(UUID.randomUUID(), host.email(), Role.PLANNER).roles()).containsExactly(Role.PLANNER);
        assertThatThrownBy(() -> User.selfRegistered(UUID.randomUUID(), host.email(), Role.ADMIN)).isInstanceOf(InvalidInputException.class);
    }

    /** REQ-07-05: the permission matrix for the four roles. */
    @ParameterizedTest
    @EnumSource(Role.class)
    void permissionMatrix(Role role) {
        var expected = switch (role) {
            case ADMIN -> EnumSet.allOf(Permission.class);
            case HOST -> EnumSet.of(Permission.MANAGE_CELEBRATION, Permission.VIEW_PROVIDER);
            case PLANNER -> EnumSet.of(Permission.MANAGE_CELEBRATION, Permission.MANAGE_ORGANIZATION, Permission.VIEW_PROVIDER);
            case PROVIDER -> EnumSet.of(Permission.MANAGE_PROVIDER, Permission.VIEW_PROVIDER);
        };
        for (var permission : Permission.values()) assertThat(role.grants(permission)).as(role + " → " + permission).isEqualTo(expected.contains(permission));
    }

    @Test
    void accessGrantMergesMembershipRolesAndOrganizations() {
        var orgB = UUID.fromString("00000000-0000-0000-0000-00000000000b");
        var orgA = UUID.fromString("00000000-0000-0000-0000-00000000000a");
        var grant = AccessGrant.of(host, List.of(new OrganizationMember(orgB, host.id(), Role.PLANNER), new OrganizationMember(orgA, host.id(), Role.HOST)));
        assertThat(grant.roles()).containsExactly("HOST", "PLANNER");
        assertThat(grant.organizationIds()).containsExactly(orgA.toString(), orgB.toString());
        assertThatThrownBy(() -> AccessGrant.of(host, List.of(new OrganizationMember(orgA, UUID.randomUUID(), Role.HOST)))).isInstanceOf(IllegalArgumentException.class);
    }

    /** REQ-07-02: RS256 with 15-minute access tokens; one changed byte is rejected. */
    @Test
    void accessTokenCarriesClaimsAndRejectsTampering() {
        var now = Instant.parse("2026-10-21T12:00:00Z");
        var jwt = new Rs256JwtService(Rs256JwtService.generateKeyPair(), "rsvp-identity", Clock.fixed(now, ZoneOffset.UTC));
        var token = jwt.issue(new AccessGrant(host.id(), List.of("HOST"), List.of()));
        assertThat(jwt.verify(token)).isTrue();
        var payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);
        assertThat(payload).contains("\"sub\":\"" + host.id() + "\"", "\"roles\":[\"HOST\"]", "\"organizationIds\":[]", "\"iss\":\"rsvp-identity\"")
            .contains("\"exp\":" + (now.getEpochSecond() + 900));
        var header = new String(Base64.getUrlDecoder().decode(token.split("\\.")[0]), StandardCharsets.UTF_8);
        assertThat(header).contains("\"kid\":\"" + jwt.kid() + "\"");
        var signatureStart = token.lastIndexOf('.') + 1;
        var altered = token.substring(0, signatureStart) + (token.charAt(signatureStart) == 'A' ? 'B' : 'A') + token.substring(signatureStart + 1);
        assertThat(jwt.verify(altered)).isFalse();
        var payloadAltered = token.replaceFirst("\\.[^.]", "." + (token.split("\\.")[1].charAt(0) == 'e' ? 'f' : 'e'));
        assertThat(jwt.verify(payloadAltered)).isFalse();
        assertThat(jwt.jwks()).contains("\"kty\":\"RSA\"", "\"kid\":\"" + jwt.kid() + "\"");
    }

    @Test
    void kidIsStableForTheSameKeyAndChangesWithANewKey() {
        var keys = Rs256JwtService.generateKeyPair();
        var a = new Rs256JwtService(keys, "i", Clock.systemUTC());
        var b = new Rs256JwtService(keys, "i", Clock.systemUTC());
        var other = new Rs256JwtService(Rs256JwtService.generateKeyPair(), "i", Clock.systemUTC());
        assertThat(a.kid()).isEqualTo(b.kid()).isNotEqualTo(other.kid());
        // The key is generated above, in memory. The label is split so secret scanners do not read a PEM literal.
        var label = "PRIVATE" + " KEY";
        var pem = "-----BEGIN " + label + "-----\n" + Base64.getMimeEncoder().encodeToString(keys.getPrivate().getEncoded()) + "\n-----END " + label + "-----";
        assertThat(new Rs256JwtService(Rs256JwtService.keyPairFromPkcs8Pem(pem), "i", Clock.systemUTC()).kid()).isEqualTo(a.kid());
    }

    /** REQ-07-03: reuse of a rotated refresh token revokes the whole chain. */
    @Test
    void refreshReuseRevokesTheChainAndLogoutIsIdempotent() {
        var refresh = new RefreshTokenRotation(new InMemoryRefreshTokenRepository());
        var first = refresh.issue(host.id());
        var second = refresh.rotate(first);
        assertThat(second.userId()).isEqualTo(host.id());
        assertThatThrownBy(() -> refresh.rotate(first)).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> refresh.rotate(second.refreshToken())).as("successor revoked by reuse").isInstanceOf(UnauthorizedException.class);

        var other = refresh.issue(host.id());
        refresh.logout(other);
        refresh.logout(other);
        refresh.logout("unknown-token");
        assertThatThrownBy(() -> refresh.rotate(other)).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> refresh.rotate("")).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void expiredRefreshTokenIsRejected() {
        var clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        var refresh = new RefreshTokenRotation(new InMemoryRefreshTokenRepository(), clock);
        var token = refresh.issue(host.id());
        clock.now.set(clock.now.get().plus(RefreshTokenRotation.LIFETIME).plus(Duration.ofSeconds(1)));
        assertThatThrownBy(() -> refresh.rotate(token)).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void concurrentRotationOfOneTokenHasOneWinner() throws Exception {
        var refresh = new RefreshTokenRotation(new InMemoryRefreshTokenRepository());
        var token = refresh.issue(host.id());
        var tasks = new ArrayList<Callable<Boolean>>();
        for (int i = 0; i < 8; i++) tasks.add(() -> { try { refresh.rotate(token); return true; } catch (UnauthorizedException e) { return false; } });
        try (var pool = Executors.newFixedThreadPool(8)) {
            var wins = pool.invokeAll(tasks).stream().filter(future -> { try { return future.get(); } catch (Exception e) { return false; } }).count();
            assertThat(wins).isEqualTo(1);
        }
    }

    @Test
    void passwordRecoveryNeverRevealsWhetherTheAccountExists() {
        var sent = new ArrayList<UUID>();
        var recovery = new PasswordRecoveryService(email -> email.equals(host.email()) ? Optional.of(host.id()) : Optional.empty(), (id, email) -> sent.add(id));
        recovery.request("HOST@example.test");
        recovery.request("unknown@example.test");
        assertThat(sent).containsExactly(host.id());
        assertThatThrownBy(() -> recovery.request("nope")).isInstanceOf(InvalidInputException.class);
    }

    @Test
    void usersNeedARole() {
        assertThatThrownBy(() -> new User(UUID.randomUUID(), new EmailAddress("a@b.co"), Set.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new OrganizationMember(UUID.randomUUID(), UUID.randomUUID(), Role.ADMIN)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void organizationInvariantsAndRoleChecks() {
        var organization = new com.rsvp.identity.domain.Organization(UUID.randomUUID(), "Bodas Andinas", host.id());
        assertThat(organization.ownerUserId()).isEqualTo(host.id());
        assertThatThrownBy(() -> new com.rsvp.identity.domain.Organization(UUID.randomUUID(), " ", host.id())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new com.rsvp.identity.domain.Organization(null, "x", host.id())).isInstanceOf(NullPointerException.class);
        assertThat(host.hasRole(Role.HOST)).isTrue();
        assertThat(host.hasRole(Role.ADMIN)).isFalse();
        assertThat(host.email()).hasToString("host@example.test");
        assertThatThrownBy(() -> PasswordPolicy.check("   ")).isInstanceOf(InvalidInputException.class);
    }

    /** Secrets must not reach logs through toString. */
    @Test
    void sessionsAreRedactedWhenPrinted() {
        var session = new com.rsvp.identity.application.Session("access-secret", "refresh-secret", 900);
        assertThat(session.toString()).doesNotContain("secret");
        var rotated = new RefreshTokenRotation.Rotated(host.id(), "refresh-secret");
        assertThat(rotated.toString()).doesNotContain("secret").contains(host.id().toString());
    }

    @Test
    void signingKeysAreValidated() throws Exception {
        var ec = java.security.KeyPairGenerator.getInstance("EC").generateKeyPair();
        assertThatThrownBy(() -> new Rs256JwtService(ec, "i", Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
        var smallGenerator = java.security.KeyPairGenerator.getInstance("RSA");
        smallGenerator.initialize(1024);
        assertThatThrownBy(() -> new Rs256JwtService(smallGenerator.generateKeyPair(), "i", Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Rs256JwtService.keyPairFromPkcs8Pem("not a key")).isInstanceOf(IllegalArgumentException.class);

        var jwt = new Rs256JwtService(Rs256JwtService.generateKeyPair(), "issuer \"quoted\"\n", Clock.systemUTC());
        var token = jwt.issue(new AccessGrant(host.id(), List.of(), List.of()));
        var payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);
        assertThat(payload).contains("\"iss\":\"issuer \\\"quoted\\\"\\u000a\"");
        assertThat(jwt.verify("only.two")).isFalse();
        assertThat(jwt.verify("a.b.!!!")).isFalse();
    }

    private static final class MutableClock extends Clock {
        final AtomicReference<Instant> now;
        MutableClock(Instant start) { now = new AtomicReference<>(start); }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    }
}

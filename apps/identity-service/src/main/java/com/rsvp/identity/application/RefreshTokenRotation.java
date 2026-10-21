package com.rsvp.identity.application;

import com.rsvp.identity.domain.port.outbound.RefreshTokenRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import java.util.logging.Logger;

/** Opaque, single-use refresh tokens. Presenting a used token revokes its whole chain. */
public final class RefreshTokenRotation {
    public static final Duration LIFETIME = Duration.ofDays(30);
    private static final Logger LOG = Logger.getLogger(RefreshTokenRotation.class.getName());

    private final RefreshTokenRepository repository;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenRotation(RefreshTokenRepository repository) { this(repository, Clock.systemUTC()); }
    public RefreshTokenRotation(RefreshTokenRepository repository, Clock clock) { this.repository = repository; this.clock = clock; }

    public String issue(UUID userId) { return issue(userId, UUID.randomUUID()); }

    /** Consumes the presented token and returns the user it belonged to plus its successor. */
    public Rotated rotate(String presentedToken) {
        if (presentedToken == null || presentedToken.isBlank()) throw new UnauthorizedException();
        var hash = TokenHash.sha256(presentedToken);
        var state = repository.find(hash).orElseThrow(UnauthorizedException::new);
        if (state.revoked() || state.expiresAt().isBefore(clock.instant())) {
            repository.revokeChain(state.chainId());
            throw new UnauthorizedException();
        }
        if (state.consumed() || !repository.markConsumed(hash)) {
            // The chain id is not a secret and lets operators trace the incident.
            LOG.warning(() -> "refresh token reuse detected; revoking chain " + state.chainId());
            repository.revokeChain(state.chainId());
            throw new UnauthorizedException();
        }
        return new Rotated(state.userId(), issue(state.userId(), state.chainId()));
    }

    /** Logout is deliberately idempotent: a stale token must not reveal session state. */
    public void logout(String presentedToken) {
        if (presentedToken == null || presentedToken.isBlank()) return;
        repository.find(TokenHash.sha256(presentedToken)).ifPresent(token -> repository.revokeChain(token.chainId()));
    }

    private String issue(UUID userId, UUID chainId) {
        byte[] bytes = new byte[48];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        repository.save(new RefreshTokenRepository.RefreshTokenState(TokenHash.sha256(raw), userId, chainId, clock.instant().plus(LIFETIME), false, false));
        return raw;
    }

    public record Rotated(UUID userId, String refreshToken) {
        @Override public String toString() { return "Rotated[userId=" + userId + "]"; }
    }
}

package com.rsvp.identity.application;

import com.rsvp.identity.domain.port.outbound.RefreshTokenRepository;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

public final class RefreshTokenRotation {
    private final RefreshTokenRepository repository;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenRotation(RefreshTokenRepository repository) { this.repository = repository; }

    public String issue(UUID userId) {
        return issue(userId, UUID.randomUUID());
    }

    public String rotate(String presentedToken) {
        var hash = TokenHash.sha256(presentedToken);
        var state = repository.find(hash).orElseThrow(UnauthorizedException::new);
        if (state.consumed() || state.revoked() || state.expiresAt().isBefore(Instant.now())) {
            repository.revokeChain(state.chainId());
            throw new UnauthorizedException();
        }
        repository.save(new RefreshTokenRepository.RefreshTokenState(state.tokenHash(), state.userId(), state.chainId(), state.expiresAt(), true, false));
        return issue(state.userId(), state.chainId());
    }

    private String issue(UUID userId, UUID chainId) {
        byte[] bytes = new byte[48]; random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        repository.save(new RefreshTokenRepository.RefreshTokenState(TokenHash.sha256(raw), userId, chainId, Instant.now().plus(Duration.ofDays(30)), false, false));
        return raw;
    }

    public static final class UnauthorizedException extends RuntimeException { }
}


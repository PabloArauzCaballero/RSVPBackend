package com.rsvp.identity.domain.port.outbound;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository {
    Optional<RefreshTokenState> find(String tokenHash);
    void save(RefreshTokenState state);
    /** Atomically consumes a token. Returns false when it was already consumed (a reuse). */
    boolean markConsumed(String tokenHash);
    void revokeChain(UUID chainId);
    record RefreshTokenState(String tokenHash, UUID userId, UUID chainId, Instant expiresAt, boolean consumed, boolean revoked) {}
}

package com.rsvp.identity.infrastructure;

import com.rsvp.identity.domain.port.outbound.RefreshTokenRepository;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Test double for the refresh-token port. Production uses {@code RedisRefreshTokenRepository}. */
public final class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
    private final Map<String, RefreshTokenState> tokens = new ConcurrentHashMap<>();

    public Optional<RefreshTokenState> find(String tokenHash) { return Optional.ofNullable(tokens.get(tokenHash)); }

    public void save(RefreshTokenState state) { tokens.put(state.tokenHash(), state); }

    public synchronized boolean markConsumed(String tokenHash) {
        var state = tokens.get(tokenHash);
        if (state == null || state.consumed()) return false;
        tokens.put(tokenHash, new RefreshTokenState(state.tokenHash(), state.userId(), state.chainId(), state.expiresAt(), true, state.revoked()));
        return true;
    }

    public void revokeChain(UUID chainId) {
        tokens.replaceAll((key, value) -> value.chainId().equals(chainId)
            ? new RefreshTokenState(value.tokenHash(), value.userId(), value.chainId(), value.expiresAt(), value.consumed(), true)
            : value);
    }
}

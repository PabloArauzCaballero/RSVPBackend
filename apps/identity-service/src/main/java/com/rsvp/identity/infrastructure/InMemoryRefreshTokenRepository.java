package com.rsvp.identity.infrastructure;

import com.rsvp.identity.domain.port.outbound.RefreshTokenRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public final class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
    private final Map<String, RefreshTokenState> tokens = new HashMap<>();
    public Optional<RefreshTokenState> find(String tokenHash) { return Optional.ofNullable(tokens.get(tokenHash)); }
    public void save(RefreshTokenState state) { tokens.put(state.tokenHash(), state); }
    public void revokeChain(UUID chainId) { tokens.replaceAll((key, value) -> value.chainId().equals(chainId) ? new RefreshTokenState(value.tokenHash(), value.userId(), value.chainId(), value.expiresAt(), value.consumed(), true) : value); }
}


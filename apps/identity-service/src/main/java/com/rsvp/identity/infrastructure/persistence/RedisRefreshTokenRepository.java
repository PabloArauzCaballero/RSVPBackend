package com.rsvp.identity.infrastructure.persistence;

import com.rsvp.identity.domain.port.outbound.RefreshTokenRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Refresh tokens as Redis hashes keyed by their SHA-256, never by the raw token. Each chain keeps
 * a set of its members so reuse can revoke all of them. Keys expire with the token; Redis runs
 * with AOF so a restart does not log every user out.
 */
public final class RedisRefreshTokenRepository implements RefreshTokenRepository {
    private static final String TOKEN_PREFIX = "identity:refresh:";
    private static final String CHAIN_PREFIX = "identity:refresh-chain:";
    private static final String USER = "userId";
    private static final String CHAIN = "chainId";
    private static final String EXPIRES = "expiresAt";
    private static final String CONSUMED = "consumed";
    private static final String REVOKED = "revoked";
    private static final String TRUE = "1";

    private final StringRedisTemplate redis;

    public RedisRefreshTokenRepository(StringRedisTemplate redis) { this.redis = redis; }

    @Override
    public Optional<RefreshTokenState> find(String tokenHash) {
        Map<Object, Object> fields = redis.opsForHash().entries(TOKEN_PREFIX + tokenHash);
        if (fields.isEmpty()) return Optional.empty();
        return Optional.of(new RefreshTokenState(
            tokenHash,
            UUID.fromString((String) fields.get(USER)),
            UUID.fromString((String) fields.get(CHAIN)),
            Instant.ofEpochSecond(Long.parseLong((String) fields.get(EXPIRES))),
            fields.containsKey(CONSUMED),
            fields.containsKey(REVOKED)));
    }

    @Override
    public void save(RefreshTokenState state) {
        var key = TOKEN_PREFIX + state.tokenHash();
        var ttl = Duration.between(Instant.now(), state.expiresAt());
        redis.opsForHash().putAll(key, Map.of(USER, state.userId().toString(), CHAIN, state.chainId().toString(), EXPIRES, Long.toString(state.expiresAt().getEpochSecond())));
        if (state.consumed()) redis.opsForHash().put(key, CONSUMED, TRUE);
        if (state.revoked()) redis.opsForHash().put(key, REVOKED, TRUE);
        redis.expire(key, ttl);
        var chain = CHAIN_PREFIX + state.chainId();
        redis.opsForSet().add(chain, state.tokenHash());
        redis.expire(chain, ttl);
    }

    /** HSETNX is atomic: of two concurrent rotations of one token, only the first wins. */
    @Override
    public boolean markConsumed(String tokenHash) {
        return Boolean.TRUE.equals(redis.opsForHash().putIfAbsent(TOKEN_PREFIX + tokenHash, CONSUMED, TRUE));
    }

    @Override
    public void revokeChain(UUID chainId) {
        var members = redis.opsForSet().members(CHAIN_PREFIX + chainId);
        if (members == null) return;
        for (var hash : members) {
            var key = TOKEN_PREFIX + hash;
            if (Boolean.TRUE.equals(redis.hasKey(key))) redis.opsForHash().put(key, REVOKED, TRUE);
        }
    }
}

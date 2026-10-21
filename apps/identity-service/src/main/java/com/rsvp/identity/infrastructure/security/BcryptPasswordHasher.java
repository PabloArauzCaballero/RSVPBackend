package com.rsvp.identity.infrastructure.security;

import com.rsvp.identity.domain.port.outbound.PasswordHasher;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * BCrypt with cost 12. BCrypt reads only the first 72 bytes, and the policy allows 128
 * characters, so longer inputs are rejected here rather than silently truncated.
 */
public final class BcryptPasswordHasher implements PasswordHasher {
    private static final int BCRYPT_MAX_BYTES = 72;
    private final BCryptPasswordEncoder encoder;

    public BcryptPasswordHasher(int strength) { this.encoder = new BCryptPasswordEncoder(strength); }

    @Override
    public String hash(String password) { return encoder.encode(prepare(password)); }

    @Override
    public boolean matches(String password, String hash) {
        if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            encoder.matches("", hash); // keep the timing of a normal check
            return false;
        }
        return encoder.matches(password, hash);
    }

    private static String prepare(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) throw new com.rsvp.identity.domain.InvalidInputException("password", "password must not exceed 72 bytes");
        return password;
    }
}

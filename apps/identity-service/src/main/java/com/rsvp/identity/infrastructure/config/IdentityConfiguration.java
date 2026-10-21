package com.rsvp.identity.infrastructure.config;

import com.rsvp.identity.application.IdentityService;
import com.rsvp.identity.application.PasswordRecoveryService;
import com.rsvp.identity.application.RefreshTokenRotation;
import com.rsvp.identity.application.Rs256JwtService;
import com.rsvp.identity.domain.port.outbound.PasswordHasher;
import com.rsvp.identity.domain.port.outbound.RefreshTokenRepository;
import com.rsvp.identity.domain.port.outbound.UserRepository;
import com.rsvp.identity.infrastructure.persistence.JdbcUserRepository;
import com.rsvp.identity.infrastructure.persistence.RedisRefreshTokenRepository;
import com.rsvp.identity.infrastructure.security.BcryptPasswordHasher;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class IdentityConfiguration {
    private static final Logger LOG = LoggerFactory.getLogger(IdentityConfiguration.class);

    @Bean
    Clock clock() { return Clock.systemUTC(); }

    @Bean
    UserRepository userRepository(JdbcClient jdbc, TransactionTemplate transactions) { return new JdbcUserRepository(jdbc, transactions); }

    @Bean
    RefreshTokenRepository refreshTokenRepository(StringRedisTemplate redis) { return new RedisRefreshTokenRepository(redis); }

    @Bean
    PasswordHasher passwordHasher(@Value("${identity.password.bcrypt-strength:12}") int strength) { return new BcryptPasswordHasher(strength); }

    /**
     * The signing key comes from IDENTITY_SIGNING_KEY_PEM or a mounted file. Without either, a
     * throw-away key is generated: fine locally, but every restart invalidates issued tokens.
     */
    @Bean
    Rs256JwtService jwtService(
        @Value("${identity.jwt.signing-key-pem:}") String pem,
        @Value("${identity.jwt.signing-key-file:}") String file,
        @Value("${identity.jwt.issuer}") String issuer,
        Clock clock) throws java.io.IOException {
        var source = !pem.isBlank() ? pem : !file.isBlank() ? Files.readString(Path.of(file)) : null;
        if (source == null) LOG.warn("No signing key configured; generated an ephemeral RSA key (local use only).");
        var keyPair = source == null ? Rs256JwtService.generateKeyPair() : Rs256JwtService.keyPairFromPkcs8Pem(source);
        var service = new Rs256JwtService(keyPair, issuer, clock);
        LOG.info("Signing access tokens with kid={}", service.kid());
        return service;
    }

    @Bean
    RefreshTokenRotation refreshTokenRotation(RefreshTokenRepository repository, Clock clock) { return new RefreshTokenRotation(repository, clock); }

    @Bean
    IdentityService identityService(UserRepository users, PasswordHasher hasher, Rs256JwtService jwt, RefreshTokenRotation rotation) {
        return new IdentityService(users, hasher, jwt, rotation);
    }

    /** Delivery of the recovery e-mail is a later slice (notification event); this records only the user id. */
    @Bean
    PasswordRecoveryService passwordRecoveryService(UserRepository users) {
        return new PasswordRecoveryService(
            email -> users.findByEmail(email).map(stored -> stored.user().id()),
            (userId, email) -> LOG.info("Password recovery requested for user {} (delivery pending notification slice)", userId));
    }
}

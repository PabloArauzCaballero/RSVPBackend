package com.rsvp.identity;

import com.rsvp.identity.application.RefreshTokenRotation;
import com.rsvp.identity.application.Rs256JwtService;
import com.rsvp.identity.domain.Role;
import com.rsvp.identity.domain.User;
import com.rsvp.identity.infrastructure.InMemoryRefreshTokenRepository;
import java.util.Set;
import java.util.UUID;

public final class IdentityServiceTest {
    public static void main(String[] arguments) {
        var user = new User(UUID.randomUUID(), "host@example.test", Set.of(Role.HOST));
        assert user.hasRole(Role.HOST);
        var jwt = new Rs256JwtService();
        var access = jwt.issue(user.id());
        assert jwt.verify(access);
        assert !jwt.verify(access.substring(0, access.length() - 1) + "x");
        assert jwt.jwks().contains("\"kty\":\"RSA\"");
        var refresh = new RefreshTokenRotation(new InMemoryRefreshTokenRepository());
        var first = refresh.issue(user.id());
        var second = refresh.rotate(first);
        try { refresh.rotate(first); throw new AssertionError("reuse must be rejected"); }
        catch (RefreshTokenRotation.UnauthorizedException expected) { }
        try { refresh.rotate(second); throw new AssertionError("the whole rotated chain must be revoked"); }
        catch (RefreshTokenRotation.UnauthorizedException expected) { }
        System.out.println("Identity domain tests passed.");
    }
}


package com.rsvp.identity;

import com.rsvp.identity.application.RefreshTokenRotation;
import com.rsvp.identity.application.Rs256JwtService;
import com.rsvp.identity.application.PasswordRecoveryService;
import com.rsvp.identity.domain.Role;
import com.rsvp.identity.domain.Permission;
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
        var signatureStart = access.lastIndexOf('.') + 1;
        var firstSignatureCharacter = access.charAt(signatureStart);
        var altered = access.substring(0, signatureStart) + (firstSignatureCharacter == 'A' ? 'B' : 'A') + access.substring(signatureStart + 1);
        assert !jwt.verify(altered);
        assert jwt.jwks().contains("\"kty\":\"RSA\"");
        var refresh = new RefreshTokenRotation(new InMemoryRefreshTokenRepository());
        var first = refresh.issue(user.id());
        var second = refresh.rotate(first);
        try { refresh.rotate(first); throw new AssertionError("reuse must be rejected"); }
        catch (RefreshTokenRotation.UnauthorizedException expected) { }
        refresh.logout(second);
        try { refresh.rotate(second); throw new AssertionError("logout must revoke the session chain"); }
        catch (RefreshTokenRotation.UnauthorizedException expected) { }
        assert Role.ADMIN.grants(Permission.MANAGE_PLATFORM);
        assert Role.HOST.grants(Permission.MANAGE_CELEBRATION);
        assert Role.PLANNER.grants(Permission.MANAGE_ORGANIZATION);
        assert Role.PROVIDER.grants(Permission.MANAGE_PROVIDER);
        var recoverySent = new boolean[] { false };
        var recovery = new PasswordRecoveryService(
            email -> email.equals(user.email()) ? java.util.Optional.of(user.id()) : java.util.Optional.empty(),
            (userId, email) -> recoverySent[0] = userId.equals(user.id()) && email.equals(user.email())
        );
        recovery.request(user.email());
        assert recoverySent[0];
        recovery.request("unknown@example.test");
        try { refresh.rotate(second); throw new AssertionError("the whole rotated chain must be revoked"); }
        catch (RefreshTokenRotation.UnauthorizedException expected) { }
        System.out.println("Identity domain tests passed.");
    }
}


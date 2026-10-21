package com.rsvp.identity.application;

import com.rsvp.identity.domain.AccessGrant;
import com.rsvp.identity.domain.EmailAddress;
import com.rsvp.identity.domain.InvalidInputException;
import com.rsvp.identity.domain.PasswordPolicy;
import com.rsvp.identity.domain.Role;
import com.rsvp.identity.domain.User;
import com.rsvp.identity.domain.port.outbound.PasswordHasher;
import com.rsvp.identity.domain.port.outbound.UserRepository;
import java.util.UUID;

/** Register, login, refresh and logout use cases. Framework-free: wiring lives in infrastructure. */
public final class IdentityService {
    private final UserRepository users;
    private final PasswordHasher hasher;
    private final Rs256JwtService jwt;
    private final RefreshTokenRotation refreshTokens;
    /** Checked when the e-mail is unknown, so both paths cost one hash comparison. */
    private final String timingDecoyHash;

    public IdentityService(UserRepository users, PasswordHasher hasher, Rs256JwtService jwt, RefreshTokenRotation refreshTokens) {
        this.users = users;
        this.hasher = hasher;
        this.jwt = jwt;
        this.refreshTokens = refreshTokens;
        this.timingDecoyHash = hasher.hash(UUID.randomUUID().toString());
    }

    /** Creates the account and signs it in, so a client goes from sign-up straight to a session. */
    public Registration register(String email, String password, String requestedRole) {
        var address = new EmailAddress(email);
        PasswordPolicy.check(password);
        var user = User.selfRegistered(UUID.randomUUID(), address, parseRole(requestedRole));
        try { users.create(user, hasher.hash(password)); }
        catch (UserRepository.DuplicateEmailException duplicate) { throw new ConflictException("an account already exists for this e-mail"); }
        return new Registration(user, new Session(accessTokenFor(user), refreshTokens.issue(user.id()), Rs256JwtService.ACCESS_LIFETIME.toSeconds()));
    }

    public record Registration(User user, Session session) { }

    private static Role parseRole(String role) {
        if (role == null) return null;
        try { return Role.valueOf(role); }
        catch (IllegalArgumentException unknown) { throw new InvalidInputException("role", "role must be one of HOST, PLANNER or PROVIDER"); }
    }

    public Session login(String email, String password) {
        EmailAddress address;
        try { address = new EmailAddress(email); }
        catch (InvalidInputException invalid) { throw new UnauthorizedException(); }
        var stored = users.findByEmail(address);
        var hash = stored.map(UserRepository.StoredUser::passwordHash).orElse(timingDecoyHash);
        var matches = hasher.matches(password == null ? "" : password, hash);
        if (!matches || stored.isEmpty()) throw new UnauthorizedException();
        var user = stored.get().user();
        return new Session(accessTokenFor(user), refreshTokens.issue(user.id()), Rs256JwtService.ACCESS_LIFETIME.toSeconds());
    }

    /** Rotates the refresh token and re-reads roles, so membership changes reach the next token. */
    public Session refresh(String refreshToken) {
        var rotated = refreshTokens.rotate(refreshToken);
        var user = users.findById(rotated.userId()).orElseThrow(UnauthorizedException::new);
        return new Session(accessTokenFor(user), rotated.refreshToken(), Rs256JwtService.ACCESS_LIFETIME.toSeconds());
    }

    public void logout(String refreshToken) { refreshTokens.logout(refreshToken); }

    public String jwks() { return jwt.jwks(); }

    private String accessTokenFor(User user) { return jwt.issue(AccessGrant.of(user, users.membershipsOf(user.id()))); }
}

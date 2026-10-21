package com.rsvp.identity.interfaces.http;

import com.rsvp.identity.application.IdentityService;
import com.rsvp.identity.application.PasswordRecoveryService;
import com.rsvp.identity.application.Session;
import com.rsvp.identity.domain.User;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final IdentityService identity;
    private final PasswordRecoveryService recovery;

    public AuthController(IdentityService identity, PasswordRecoveryService recovery) {
        this.identity = identity;
        this.recovery = recovery;
    }

    public record Credentials(String email, String password) {
        @Override public String toString() { return "Credentials[redacted]"; }
    }
    public record Registration(String email, String password, String role) {
        @Override public String toString() { return "Registration[redacted]"; }
    }
    public record RefreshRequest(String refreshToken) {
        @Override public String toString() { return "RefreshRequest[redacted]"; }
    }
    public record RecoveryRequest(String email) { }
    /** The account plus a session, the same token fields as login. */
    public record Registered(UUID id, String email, List<String> roles, String accessToken, String refreshToken, String tokenType, long expiresIn) { }
    public record SessionResponse(String accessToken, String refreshToken, String tokenType, long expiresIn) {
        static SessionResponse of(Session session) { return new SessionResponse(session.accessToken(), session.refreshToken(), "Bearer", session.expiresInSeconds()); }
    }

    @PostMapping("/register")
    public ResponseEntity<Registered> register(@RequestBody Registration body) {
        var registration = identity.register(body.email(), body.password(), body.role());
        User user = registration.user();
        Session session = registration.session();
        var roles = user.roles().stream().map(Enum::name).sorted().toList();
        return ResponseEntity.created(URI.create("/identity/users/" + user.id()))
            .cacheControl(CacheControl.noStore())
            .body(new Registered(user.id(), user.email().value(), roles, session.accessToken(), session.refreshToken(), "Bearer", session.expiresInSeconds()));
    }

    @PostMapping("/login")
    public ResponseEntity<SessionResponse> login(@RequestBody Credentials body) {
        return noStore(SessionResponse.of(identity.login(body.email(), body.password())));
    }

    @PostMapping("/refresh")
    public ResponseEntity<SessionResponse> refresh(@RequestBody RefreshRequest body) {
        return noStore(SessionResponse.of(identity.refresh(body.refreshToken())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody RefreshRequest body) {
        RequestValidation.refreshToken(body.refreshToken());
        identity.logout(body.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-recovery")
    public ResponseEntity<Void> passwordRecovery(@RequestBody RecoveryRequest body) {
        recovery.request(body.email());
        return ResponseEntity.accepted().build();
    }

    private static <T> ResponseEntity<T> noStore(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
}

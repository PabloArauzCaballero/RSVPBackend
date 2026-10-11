package com.rsvp.identity.application;

import java.util.Optional;
import java.util.UUID;

/** Prevents account enumeration by always accepting a recovery request. */
public final class PasswordRecoveryService {
    public interface UserLookup { Optional<UUID> findUserIdByEmail(String email); }
    public interface RecoveryNotifier { void send(UUID userId, String email); }

    private final UserLookup users;
    private final RecoveryNotifier notifier;
    public PasswordRecoveryService(UserLookup users, RecoveryNotifier notifier) { this.users = users; this.notifier = notifier; }

    public void request(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) throw new IllegalArgumentException("email must be valid");
        users.findUserIdByEmail(email).ifPresent(userId -> notifier.send(userId, email));
    }
}

package com.rsvp.identity.application;

import com.rsvp.identity.domain.EmailAddress;
import java.util.Optional;
import java.util.UUID;

/** Prevents account enumeration by always accepting a well-formed recovery request. */
public final class PasswordRecoveryService {
    public interface UserLookup { Optional<UUID> findUserIdByEmail(EmailAddress email); }
    public interface RecoveryNotifier { void send(UUID userId, EmailAddress email); }

    private final UserLookup users;
    private final RecoveryNotifier notifier;
    public PasswordRecoveryService(UserLookup users, RecoveryNotifier notifier) { this.users = users; this.notifier = notifier; }

    public void request(String email) {
        var address = new EmailAddress(email);
        users.findUserIdByEmail(address).ifPresent(userId -> notifier.send(userId, address));
    }
}

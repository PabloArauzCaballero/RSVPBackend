package com.rsvp.identity.domain.port.outbound;

import com.rsvp.identity.domain.EmailAddress;
import com.rsvp.identity.domain.OrganizationMember;
import com.rsvp.identity.domain.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    /** @throws DuplicateEmailException when the normalized e-mail already has an account. */
    void create(User user, String passwordHash);
    Optional<StoredUser> findByEmail(EmailAddress email);
    Optional<User> findById(UUID id);
    List<OrganizationMember> membershipsOf(UUID userId);

    record StoredUser(User user, String passwordHash) { }

    final class DuplicateEmailException extends RuntimeException { }
}

package com.rsvp.identity.domain;

import java.util.Objects;
import java.util.Set;
import java.util.UUID;

public record User(UUID id, EmailAddress email, Set<Role> roles) {
    public User {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(email, "email");
        roles = Set.copyOf(roles);
        if (roles.isEmpty()) throw new IllegalArgumentException("a user must have at least one role");
    }

    /** Roles a person may pick at sign-up. ADMIN is never self-service. */
    public static final Set<Role> SELF_SERVICE_ROLES = Set.of(Role.HOST, Role.PLANNER, Role.PROVIDER);

    /**
     * Sign-up as a host, or as a planner or provider. Neither grants data access by itself:
     * a planner reaches celebrations only through organization memberships, and a provider
     * is verified by the provider catalog before publishing.
     */
    public static User selfRegistered(UUID id, EmailAddress email, Role requested) {
        var role = requested == null ? Role.HOST : requested;
        if (!SELF_SERVICE_ROLES.contains(role)) throw new InvalidInputException("role", "role must be one of HOST, PLANNER or PROVIDER");
        return new User(id, email, Set.of(role));
    }

    public static User selfRegistered(UUID id, EmailAddress email) { return selfRegistered(id, email, Role.HOST); }

    public boolean hasRole(Role role) { return roles.contains(role); }
}

package com.rsvp.identity.domain;

import java.util.Objects;
import java.util.Set;
import java.util.UUID;

public record User(UUID id, String email, Set<Role> roles) {
    public User {
        Objects.requireNonNull(id, "id");
        if (email == null || !email.contains("@")) throw new IllegalArgumentException("email must be valid");
        roles = Set.copyOf(roles);
        if (roles.isEmpty()) throw new IllegalArgumentException("a user must have at least one role");
    }

    public boolean hasRole(Role role) { return roles.contains(role); }
}


package com.rsvp.identity.domain;

import java.util.Objects;
import java.util.UUID;

public record Organization(UUID id, String name, UUID ownerUserId) {
    public Organization {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(ownerUserId, "ownerUserId");
        if (name == null || name.isBlank()) throw new IllegalArgumentException("organization name is required");
    }
}


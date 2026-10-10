package com.rsvp.identity.domain;

import java.util.Objects;
import java.util.UUID;

public record OrganizationMember(UUID organizationId, UUID userId, Role role) {
    public OrganizationMember {
        Objects.requireNonNull(organizationId, "organizationId");
        Objects.requireNonNull(userId, "userId");
        if (role != Role.PLANNER && role != Role.HOST) throw new IllegalArgumentException("only planners and hosts belong to an organization");
    }
}


package com.rsvp.identity.domain;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.TreeSet;
import java.util.UUID;

/**
 * What an access token asserts about its subject: platform roles plus the roles and
 * organizations that come from memberships. Sorted, so equal grants serialize equally.
 */
public record AccessGrant(UUID subject, List<String> roles, List<String> organizationIds) {
    public AccessGrant {
        Objects.requireNonNull(subject, "subject");
        roles = List.copyOf(roles);
        organizationIds = List.copyOf(organizationIds);
    }

    public static AccessGrant of(User user, Collection<OrganizationMember> memberships) {
        var roles = new TreeSet<String>();
        user.roles().forEach(role -> roles.add(role.name()));
        var organizations = new TreeSet<String>();
        for (var membership : memberships) {
            if (!membership.userId().equals(user.id())) throw new IllegalArgumentException("membership belongs to another user");
            roles.add(membership.role().name());
            organizations.add(membership.organizationId().toString());
        }
        return new AccessGrant(user.id(), List.copyOf(roles), List.copyOf(organizations));
    }
}

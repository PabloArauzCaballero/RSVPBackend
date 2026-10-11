package com.rsvp.identity.domain;

import java.util.Set;

public enum Role {
    ADMIN(Set.of(Permission.MANAGE_PLATFORM, Permission.MANAGE_CELEBRATION, Permission.MANAGE_ORGANIZATION, Permission.MANAGE_PROVIDER, Permission.VIEW_PROVIDER)),
    HOST(Set.of(Permission.MANAGE_CELEBRATION, Permission.VIEW_PROVIDER)),
    PLANNER(Set.of(Permission.MANAGE_CELEBRATION, Permission.MANAGE_ORGANIZATION, Permission.VIEW_PROVIDER)),
    PROVIDER(Set.of(Permission.MANAGE_PROVIDER, Permission.VIEW_PROVIDER));

    private final Set<Permission> permissions;
    Role(Set<Permission> permissions) { this.permissions = permissions; }
    public boolean grants(Permission permission) { return permissions.contains(permission); }
}


package com.rsvp.identity.domain.port.outbound;

public interface PasswordHasher {
    String hash(String password);
    boolean matches(String password, String hash);
}

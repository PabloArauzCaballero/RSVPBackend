package com.rsvp.identity.domain;

/** Length-based policy (NIST SP 800-63B): long passphrases, no composition rules. */
public final class PasswordPolicy {
    public static final int MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 128;
    private PasswordPolicy() { }

    public static void check(String password) {
        if (password == null || password.isBlank()) throw new InvalidInputException("password", "password is required");
        int length = password.codePointCount(0, password.length());
        if (length < MIN_LENGTH || length > MAX_LENGTH) throw new InvalidInputException("password", "password must have between " + MIN_LENGTH + " and " + MAX_LENGTH + " characters");
    }
}

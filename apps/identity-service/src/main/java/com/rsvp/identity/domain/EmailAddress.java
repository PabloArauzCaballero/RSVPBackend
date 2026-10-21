package com.rsvp.identity.domain;

import java.util.Locale;
import java.util.regex.Pattern;

/** A normalized e-mail: trimmed and lower-cased, so one mailbox maps to one account. */
public record EmailAddress(String value) {
    private static final int MAX_LENGTH = 320;
    private static final Pattern SHAPE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public EmailAddress {
        if (value == null) throw new InvalidInputException("email", "email is required");
        value = value.trim().toLowerCase(Locale.ROOT);
        if (value.length() > MAX_LENGTH || !SHAPE.matcher(value).matches()) throw new InvalidInputException("email", "email must be valid");
    }

    @Override public String toString() { return value; }
}

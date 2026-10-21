package com.rsvp.identity.domain;

/** A rejected input. It names the field but never echoes the submitted value. */
public final class InvalidInputException extends RuntimeException {
    private final String field;
    public InvalidInputException(String field, String message) { super(message); this.field = field; }
    public String field() { return field; }
}

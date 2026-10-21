package com.rsvp.identity.application;

/** Authentication failed. Deliberately carries no reason, so callers cannot probe accounts. */
public final class UnauthorizedException extends RuntimeException {
    public UnauthorizedException() { super("authentication failed", null, false, false); }
}

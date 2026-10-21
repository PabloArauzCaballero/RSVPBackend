package com.rsvp.identity.application;

/** Tokens handed to a client after login or refresh. Never log an instance. */
public record Session(String accessToken, String refreshToken, long expiresInSeconds) {
    @Override public String toString() { return "Session[redacted]"; }
}

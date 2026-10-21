package com.rsvp.identity.interfaces.http;

import com.rsvp.identity.domain.InvalidInputException;

/** Edge checks that mirror the OpenAPI schemas. */
final class RequestValidation {
    private static final int REFRESH_MIN = 32;
    private static final int REFRESH_MAX = 4096;
    private RequestValidation() { }

    static void refreshToken(String token) {
        if (token == null || token.length() < REFRESH_MIN || token.length() > REFRESH_MAX) throw new InvalidInputException("refreshToken", "refreshToken must have between 32 and 4096 characters");
    }
}

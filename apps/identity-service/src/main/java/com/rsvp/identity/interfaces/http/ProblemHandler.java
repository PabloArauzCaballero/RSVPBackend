package com.rsvp.identity.interfaces.http;

import com.rsvp.identity.application.ConflictException;
import com.rsvp.identity.application.UnauthorizedException;
import com.rsvp.identity.domain.InvalidInputException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** RFC 9457 problems shaped like the contract's Problem schema. Never echoes submitted values. */
@RestControllerAdvice
public class ProblemHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ProblemHandler.class);
    private static final MediaType PROBLEM = MediaType.APPLICATION_PROBLEM_JSON;

    @ExceptionHandler(InvalidInputException.class)
    ResponseEntity<Map<String, Object>> invalid(InvalidInputException exception, HttpServletRequest request) {
        var body = problem("validation-failed", "Validation failed", HttpStatus.UNPROCESSABLE_ENTITY, request);
        body.put("errors", java.util.List.of(Map.of("field", exception.field(), "message", exception.getMessage())));
        return respond(HttpStatus.UNPROCESSABLE_ENTITY, body);
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, HttpMediaTypeNotSupportedException.class })
    ResponseEntity<Map<String, Object>> unreadable(Exception exception, HttpServletRequest request) {
        return respond(HttpStatus.UNPROCESSABLE_ENTITY, problem("validation-failed", "Request body must be a JSON object", HttpStatus.UNPROCESSABLE_ENTITY, request));
    }

    @ExceptionHandler(UnauthorizedException.class)
    ResponseEntity<Map<String, Object>> unauthorized(HttpServletRequest request) {
        return respond(HttpStatus.UNAUTHORIZED, problem("unauthorized", "Authentication failed", HttpStatus.UNAUTHORIZED, request));
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<Map<String, Object>> conflict(HttpServletRequest request) {
        return respond(HttpStatus.CONFLICT, problem("conflict", "An account already exists for this e-mail", HttpStatus.CONFLICT, request));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception exception, HttpServletRequest request) {
        var body = problem("internal-error", "Unexpected error", HttpStatus.INTERNAL_SERVER_ERROR, request);
        LOG.error("Unhandled error correlationId={}", body.get("correlationId"), exception);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, body);
    }

    private static Map<String, Object> problem(String type, String title, HttpStatus status, HttpServletRequest request) {
        var body = new LinkedHashMap<String, Object>();
        body.put("type", "https://rsvp.local/problems/" + type);
        body.put("title", title);
        body.put("status", status.value());
        body.put("correlationId", CorrelationIdFilter.current(request));
        return body;
    }

    private static ResponseEntity<Map<String, Object>> respond(HttpStatus status, Map<String, Object> body) {
        return ResponseEntity.status(status).contentType(PROBLEM).body(body);
    }
}

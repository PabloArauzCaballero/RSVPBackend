package com.rsvp.identity.interfaces.http;

import com.rsvp.identity.application.IdentityService;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicController {
    private final IdentityService identity;

    public PublicController(IdentityService identity) { this.identity = identity; }

    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok", "service", "identity"); }

    /** Short cache: a rotated key reaches consumers within five minutes. */
    @GetMapping(value = "/.well-known/jwks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> jwks() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic()).body(identity.jwks());
    }
}

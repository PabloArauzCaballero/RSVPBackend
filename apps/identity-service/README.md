# Identity Service

The Phase 0 reference implementation keeps the core domain framework-free and compiles with Java 21 using `corepack yarn workspace @rsvp/identity-service test`.

The production Spring Boot adapters, Flyway runtime, Redis adapter and HTTP controllers build on these ports in the identity lane. Signing-key rotation uses `kid`: serve old and new public keys together during a rollover, issue only with the new key, then remove the old key after the maximum 15-minute access-token lifetime.


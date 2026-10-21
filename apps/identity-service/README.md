# Identity Service

Spring Boot 3.5 / Java 21. Emits the RS256 access tokens every service validates and owns `identity_db`.

## Run

```
corepack yarn workspace @rsvp/identity-service test    # unit + ArchUnit + Testcontainers (needs Docker)
corepack yarn workspace @rsvp/identity-service build   # bootJar
docker compose --profile apps up -d --build identity-service   # behind Kong at http://localhost:8000/identity
node e2e/gateway/identity-live.mjs                     # live check: Identity token used on Celebration
```

## API (see `packages/contracts-openapi/specs/identity.openapi.json`)

| Route | Result |
|---|---|
| `POST /auth/register` `{email, password, role?}` | 201 account + session. `role`: `HOST` (default), `PLANNER`, `PROVIDER`; `ADMIN` → 422. Duplicate e-mail → 409 |
| `POST /auth/login` `{email, password}` | 200 `{accessToken, refreshToken, tokenType, expiresIn}`; any failure → identical 401 |
| `POST /auth/refresh` `{refreshToken}` | 200 rotated session; reusing a consumed token revokes the whole chain (401) |
| `POST /auth/logout` `{refreshToken}` | 204, idempotent |
| `POST /auth/password-recovery` `{email}` | 202 whether or not the account exists (delivery pending the notification slice) |
| `GET /.well-known/jwks.json` | RS256 public key |

Access-token claims: `iss`, `sub`, `roles[]`, `organizationIds[]`, `iat`, `exp` (15 min), `jti`. Roles merge the user's platform roles with organization-membership roles, and a refresh re-reads them.

## Layers

`domain` (records, ports, no framework) → `application` (use cases, JWT, refresh rotation) → `infrastructure` (JDBC, Redis, BCrypt, Spring wiring) and `interfaces/http`. `ArchitectureTest` fails the build if `domain` or `application` import Spring, JPA or Servlet.

## Signing keys

Set `IDENTITY_SIGNING_KEY_PEM` (PKCS#8). Without it a throw-away key is generated and a restart invalidates issued tokens. The `kid` is the RFC 7638 thumbprint, so the same key keeps its `kid`. Rotation: serve old and new public keys together, issue only with the new key, then drop the old one after the 15-minute access-token lifetime (multi-key serving is a later slice).

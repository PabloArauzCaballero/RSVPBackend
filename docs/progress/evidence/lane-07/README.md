# Carril 07 · Identity · primer slice vertical

**Fecha:** 2026-10-21 · **Dueño:** Pablo (eje A) · **Estado:** `REGRESSION_VERIFIED` del primer slice. El carril **no** está `DONE`.

## Slice

| | |
|---|---|
| **Resultado observable** | Una persona se registra e inicia sesión en Identity a través de Kong; Celebration valida ese token contra el JWKS real de Identity y aplica sus roles. |
| **Entrada** | `POST /identity/auth/register`, `POST /identity/auth/login`, `refresh`, `logout`, `GET /identity/.well-known/jwks.json` |
| **Capas** | dominio · aplicación · Postgres (Flyway) · Redis · HTTP · Docker Compose · Kong · consumidor Celebration |
| **Casos negativos** | e-mail duplicado (sin distinguir mayúsculas) 409, contraseña corta 422, `ADMIN` autoasignado 422, credencial errónea 401, token alterado 401, sin token 401, otro usuario 404, refresh reutilizado revoca la cadena |
| **Gates visuales / animación** | `N/A`: backend puro. El contrato que consume el frontend se documenta abajo. |

## REQ → prueba → resultado

| REQ | Estado | Prueba / artefacto | Resultado |
|---|---|---|---|
| REQ-07-01 Dominio hexagonal sin framework | **PASS** | `ArchitectureTest` (ArchUnit, 4 reglas: `domain` y `application` sin Spring/JPA/Servlet/Lettuce; sin dependencias hacia capas externas) | 4/4 |
| REQ-07-02 JWT RS256, access 15 min, un byte alterado se rechaza | **PASS** | `DomainAndApplicationTest.accessTokenCarriesClaimsAndRejectsTampering`; integración verifica la firma con la clave del JWKS servido; en vivo, Celebration rechaza un byte cambiado (401) | unidad + integración + vivo |
| REQ-07-03 Refresh opaco 30 días en Redis con rotación; el reuso invalida la cadena y se registra | **PASS** | `refreshReuseRevokesTheChainAndLogoutIsIdempotent`, `concurrentRotationOfOneTokenHasOneWinner` (8 hilos, 1 ganador), `IdentityApiIntegrationTest.refreshRotationReuseAndLogout` contra Redis real; log `WARN refresh token reuse detected; revoking chain <id>` | unidad + Redis real + vivo |
| REQ-07-04 `GET /.well-known/jwks.json` | **PASS (servicios)** · **BLOCKED-EXTERNAL (Kong)** | Celebration valida contra `http://identity-service:8080/.well-known/jwks.json` con `IDENTITY_JWKS_JSON` vacío. Kong OSS no valida JWKS remoto (bloqueo ya registrado). | vivo ×3 |
| REQ-07-05 Matriz de permisos de 4 roles | **PARTIAL** | `permissionMatrix` parametrizado (4 roles × 5 permisos). Falta "contra todos los endpoints": Identity aún no tiene endpoints protegidos por rol (llegan con organizaciones). | 4/4 |
| REQ-07-06 Organizaciones para planners | **PARTIAL** | El token lleva `organizationIds` y el rol `PLANNER` desde `organization_member`, y un refresh refleja una membresía nueva (integración). Falta la API para crear organizaciones e invitar miembros. | integración |

## Comandos

| Comando | Fecha | Resultado |
|---|---|---|
| `corepack yarn workspace @rsvp/identity-service test` (Gradle: unidad + ArchUnit + Testcontainers Postgres 17.6 / Redis 8.2.1) | 2026-10-21 | exit 0 · 28/28 (Architecture 4, DomainAndApplication 18, IdentityApiIntegration 6) |
| JaCoCo (`build/reports/jacoco/test/jacocoTestReport.xml`) | 2026-10-21 | líneas: `domain` 100 %, `application` 95,3 %, global 95,5 % |
| `docker compose --profile apps build identity-service` | 2026-10-21 | imagen construida; contenedor `healthy` |
| `node e2e/gateway/identity-live.mjs` ×3 | 2026-10-21 | 3/3 exit 0 · [run 1](identity-live-run-1.txt) · [run 2](identity-live-run-2.txt) · [run 3](identity-live-run-3.txt) |
| `corepack yarn contracts:validate` | 2026-10-21 | 8 OpenAPI + 56 AsyncAPI válidos |
| `node e2e/gateway/validate-config.mjs` | 2026-10-21 | sin fallos |
| Revisión de logs del contenedor (e-mails, contraseñas, `eyJ`, refresh) | 2026-10-21 | solo ids técnicos y `correlationId` de Kong |

## Contrato

`packages/contracts-openapi/specs/identity.openapi.json` sigue en `1.0.0`: el cambio es aditivo (se documentan cuerpos, `Session`, `Registration`, `Jwks`, `AccessTokenClaims` y `Problem.errors`). Claims del access token: `iss`, `sub`, `roles[]`, `organizationIds[]`, `iat`, `exp`, `jti`.

Compatibilidad con `RSVPFrontend/packages/auth/src/identity/client.ts`:

- `login` y `refresh` devuelven `accessToken`, `refreshToken`, `expiresIn` (`TokenPair`). Compatible.
- `register` acepta el `role` que envía el cliente (`HOST`, `PLANNER`, `PROVIDER`) y responde 201 con la sesión, como espera `sessionFromTokens`. Compatible.
- El cliente aún no lee `organizationIds`; el frontend debe adoptarlo para las pantallas de planner (pendiente en RSVPFrontend, F05).

## No cubierto en este slice

- Clave de firma persistente: sin `IDENTITY_SIGNING_KEY_PEM`, la clave es efímera y un reinicio invalida los tokens emitidos. Rotación con dos claves publicadas: documentada en el README, sin prueba todavía.
- Entrega del correo de recuperación (requiere evento hacia Notification); hoy solo responde 202.
- Outbox de Identity y sobre de eventos idéntico al de NestJS (DoD del carril).
- Pact publicado (bloqueo del broker) y revisión por otro eje.
- Cookies de sesión para la web (bloqueo F05 del frontend).

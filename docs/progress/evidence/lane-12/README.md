# Carril 12 · Modos AUTO_ACCEPT y RESTRICTED

| REQ | Estado | Prueba |
|---|---|---|
| REQ-12-01 cuatro modos persistidos | PASS | `domain.test.mjs` REQ-12-01/03/04 |
| REQ-12-02 `CelebrationSettingsUpdated.v1` por outbox | PASS | `http.test.mjs` REQ-13-03/REQ-12-02 · `contracts.test.mjs` (esquema AsyncAPI campo por campo) · `postgres.integration` (llega a `celebration.events` en RabbitMQ con la routing key del contrato) |
| REQ-12-03 `rsvpDeadline` y `partnerPriorityEnabled` en el evento | PASS | `domain.test.mjs` REQ-12-02 |
| REQ-12-04 no retroactivo | PASS | `contracts.test.mjs`: con 3 reservas pendientes en el `GiftListService` real de Fabio, el evento AUTO_ACCEPT real las deja en `PENDING_REVIEW`; solo la nueva se confirma sola. Lo mismo con `resolveCompanions` de Miguel |
| REQ-12-05 solo anfitrión o planner; otros 403 | PASS | `http.test.mjs` REQ-12-05 (anfitrión 200, planner 200, miembro de la organización 403) |
| REQ-12-06 nace RESTRICTED | PASS | `domain.test.mjs` REQ-12-06 · `http.test.mjs` creación |

Contrato publicado: `packages/contracts-asyncapi/celebration/settings-updated.v1.yaml` (payload plano, `settingsVersion` monótono, `effectiveFrom` y reglas de consumo).

Pendiente para `DONE`: confirmación por escrito de Miguel y Fabio de que el payload les sirve.

# Carril 11 · Tipos de evento dirigidos por datos

| REQ | Estado | Prueba |
|---|---|---|
| REQ-11-01 persistido, sin `switch`/`if` por tipo | PASS | `architecture.test.mjs`: ningún código de tipo aparece en `src/` y no hay `switch` |
| REQ-11-02 `hostRoles` por tipo | PASS | `domain.test.mjs` REQ-11-02/03/04 (boda `[BRIDE, GROOM]`, quinceaños `[CELEBRANT]`) |
| REQ-11-03 campos obligatorios distintos | PASS | `domain.test.mjs` REQ-13-01/02 |
| REQ-11-04 templates compatibles por tipo | PASS | `domain.test.mjs` y `http.test.mjs` REQ-16-05 (template de quinceaños → 422 en una boda) |
| REQ-11-05 traducciones en `event_type_translations` | PASS | `http.test.mjs` REQ-11-01/05 (`es-BO`, `en-US`, fallback de `fr-FR`) |
| REQ-11-06 tipo nuevo sin desplegar | PASS | `http.test.mjs` y `postgres.integration` REQ-11-06: BAUTIZO no existe → 422; se inserta el seed en caliente → se crea y se publica |

DoD específico:
- Un tipo nuevo se documenta como insertar una fila: `db/seeds/event-types.sql` (verificado contra `celebration_db`) o `PUT /celebrations/admin/event-types/{CODE}`.
- Seeds versionados e idempotentes: `db/seeds/event-types/*.json`; aplicar el upsert dos veces no cambia nada.

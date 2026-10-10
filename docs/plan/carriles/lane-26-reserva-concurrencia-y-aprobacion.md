# Carril 26 · Reserva de regalo y concurrencia

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `apps/gift-list-service` |
| **Predecesores** | 25 · 04 (Pablo) |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Dos invitados pueden pulsar el mismo botón en el mismo milisegundo. Exactamente uno debe ganar. Es la invariante más dura del proyecto y no se prueba con mocks: necesita Postgres real y peticiones realmente simultáneas.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-26-01` | Transición protegida por lock optimista | `UPDATE ... WHERE id = ? AND version = ?`; cero filas afectadas significa conflicto |
| `REQ-26-02` | **20 peticiones concurrentes: 1 devuelve 201 y 19 devuelven 409** | Repetido 10 veces sin un solo resultado distinto |
| `REQ-26-03` | El 409 es `GiftNotAvailable`, con mensaje accionable | La interfaz puede sugerir alternativas |
| `REQ-26-04` | Solo el anfitrión resuelve una solicitud pendiente | Otro usuario recibe 403 |
| `REQ-26-05` | Rechazar devuelve el regalo a `AVAILABLE` | Queda disponible para otro invitado inmediatamente |
| `REQ-26-06` | Cada transición emite su evento por outbox | `GiftReservationRequested`, `Confirmed`, `Rejected` y `GiftItemReleased` |

---

## Qué se construye

- `apps/gift-list-service/src/application/command/request-reservation.ts`
- `apps/gift-list-service/src/application/command/confirm-reservation.ts`
- `apps/gift-list-service/src/application/command/reject-reservation.ts`
- `apps/gift-list-service/src/infrastructure/persistence/prisma/gift-item.repository.ts`
- `apps/gift-list-service/test/integration/concurrency.spec.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Repositorio con actualización condicionada por versión.
2. Comando de solicitud con manejo del conflicto.
3. Comandos de confirmación y rechazo con autorización.
4. Prueba de concurrencia real contra Postgres.

---

## Plan de pruebas

- **20 peticiones simultáneas reales contra Testcontainers: 1 y 19. Repetido 10 veces.**
- Confirmación por un usuario sin permiso: 403.
- Rechazo seguido de nueva solicitud: la segunda gana.
- Fuga cross-tenant en los tres comandos.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El test de concurrencia corre contra Postgres real, nunca con un repositorio simulado.
- [ ] El test está marcado para correr en serie y no contamina al resto de la suite.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-26/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un test de concurrencia con mocks pasa siempre y no prueba nada. Es la trampa más común de este carril.
- `Promise.all` sobre el mismo proceso no garantiza simultaneidad real en la base. Hay que verificar que las transacciones se solapan.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 26 completo
```

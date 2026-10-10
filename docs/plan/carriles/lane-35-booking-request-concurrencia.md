# Carril 35 · Reserva de fecha y concurrencia

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [07](../calendario/semana-07.md) · 30 de noviembre al 4 de diciembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 34 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El cliente aparta una fecha y el proveedor confirma o rechaza. La misma invariante de concurrencia que la reserva de regalos: si queda un solo cupo y dos personas lo piden a la vez, exactamente una gana.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-35-01` | `BookingRequest` con estados `REQUESTED`, `CONFIRMED`, `REJECTED`, `CANCELLED` y `EXPIRED` | Transiciones explícitas |
| `REQ-35-02` | **20 solicitudes concurrentes al último cupo: 1 devuelve 201 y 19 devuelven 409** | Repetido 10 veces sin variación |
| `REQ-35-03` | Una fecha bloqueada o fuera de reglas devuelve 422 | No 409: no es un conflicto, es una fecha inválida |
| `REQ-35-04` | Solo el proveedor confirma o rechaza | Otro usuario recibe 403 |
| `REQ-35-05` | Expiración por tiempo si el proveedor no responde | El cupo se libera automáticamente |
| `REQ-35-06` | Eventos por outbox en cada transición | `BookingRequested`, `Confirmed`, `Rejected` y `Expired` |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/booking-request.ts`
- `apps/provider-catalog-service/src/application/command/request-booking.ts`
- `apps/provider-catalog-service/src/application/command/resolve-booking.ts`
- `apps/provider-catalog-service/test/integration/booking-concurrency.spec.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Agregado y máquina de estados.
2. Comando de solicitud con lock optimista sobre la capacidad del día.
3. Confirmación, rechazo y autorización.
4. Expiración programada y prueba de concurrencia real.

---

## Plan de pruebas

- **20 concurrentes al último cupo contra Postgres real: 1 y 19. Repetido 10 veces.**
- Fecha bloqueada: 422. Fecha sin cupo: 409.
- Resolución por un usuario sin permiso: 403.
- Expiración: el cupo vuelve a estar disponible.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El test de concurrencia corre contra Postgres real.
- [ ] La diferencia entre 409 y 422 está documentada en el OpenAPI.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-35/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Reutilizá el patrón del carril 26 en vez de inventar otro. Dos mecanismos distintos de concurrencia en el mismo servicio es deuda garantizada.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 35 completo
```

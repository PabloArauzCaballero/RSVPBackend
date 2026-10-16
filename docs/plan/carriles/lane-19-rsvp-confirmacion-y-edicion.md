# Carril 19 · RSVP: confirmación y edición

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `apps/guest-rsvp-service` |
| **Predecesores** | 18 · 12 (Leo) |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El flujo central del producto desde el punto de vista del invitado. Confirma o rechaza, y puede cambiar de opinión hasta la fecha límite. Pasado el plazo, la respuesta queda congelada.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-19-01` | Agregado `Rsvp` con estados `PENDING`, `CONFIRMED` y `DECLINED` | Las tres transiciones probadas unitariamente |
| `REQ-19-02` | Un `Rsvp` por `Guest`, relación uno a uno | Intentar crear un segundo devuelve 409 |
| `REQ-19-03` | **Editable hasta `rsvpDeadline`** | Con reloj fijo: antes del plazo 200, después 409 `RsvpWindowClosed` |
| `REQ-19-04` | El plazo se evalúa en la timezone de la celebración | Un invitado en otra zona horaria no gana ni pierde horas |
| `REQ-19-05` | Cada cambio emite su evento por outbox | `RsvpConfirmed.v1`, `RsvpDeclined.v1` y `RsvpChanged.v1` |
| `REQ-19-06` | Campos de dieta y mensaje opcionales | Se persisten y llegan al resumen del anfitrión |

---

## Qué se construye

- `apps/guest-rsvp-service/src/domain/model/rsvp.ts`
- `apps/guest-rsvp-service/src/domain/policy/rsvp-window.ts`
- `apps/guest-rsvp-service/src/application/command/confirm-rsvp.ts`
- `apps/guest-rsvp-service/src/application/command/decline-rsvp.ts`
- `apps/guest-rsvp-service/src/interface/rest/rsvp.controller.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Confirmar una asistencia real con token y leer el estado actualizado; repetir la petición sin doble efecto.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-19-01, REQ-19-02, REQ-19-03, REQ-19-04, REQ-19-05, REQ-19-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F15 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F15 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Agregado `Rsvp` y política de ventana temporal, con tests de reloj fijo.
2. Comandos de confirmar, rechazar y cambiar, con eventos en outbox.
3. Endpoints autenticados por token de invitado.
4. Integración con `rsvpDeadline` y `timeZone` del evento de celebración.

---

## Plan de pruebas

- **Reloj fijo**: un minuto antes del plazo 200; un minuto después 409.
- Cambio de CONFIRMED a DECLINED dentro del plazo: 200 y evento `RsvpChanged`.
- Plazo evaluado en `America/La_Paz` con el servidor en UTC.
- Fuga cross-tenant en todos los endpoints.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Ningún test usa `sleep` ni espera tiempo real.
- [ ] El mensaje de error de plazo cerrado indica la fecha límite en el idioma del invitado.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-19/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Si el plazo se evalúa con la hora del servidor en vez de la del evento, el bug aparece solo para invitados de otro huso y nadie lo reproduce.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 19 completo
```

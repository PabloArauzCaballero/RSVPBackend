# Carril 12 · Modos AUTO_ACCEPT y RESTRICTED

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `apps/celebration-site-service` |
| **Predecesores** | 10 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El anfitrión decide cuánto control quiere. Cuatro interruptores por celebración deciden si las solicitudes se aprueban solas o pasan por su bandeja. Miguel y Fabio consumen estos ajustes: si este carril se atrasa, los suyos se bloquean.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-12-01` | Cuatro modos independientes persistidos | `giftReservationMode`, `unregisteredRsvpMode`, `extraCompanionMode` y `externalGiftMode` |
| `REQ-12-02` | `CelebrationSettingsUpdated.v1` publicado por outbox | El evento llega a Guest/RSVP y a Gift List |
| `REQ-12-03` | `rsvpDeadline` y `partnerPriorityEnabled` en el mismo agregado | Ambos viajan en el evento |
| `REQ-12-04` | **El cambio de modo no es retroactivo** | Con 3 solicitudes pendientes, cambiar a AUTO_ACCEPT las deja pendientes |
| `REQ-12-05` | Solo el anfitrión o el planner pueden cambiar los modos | Otro rol recibe 403 |
| `REQ-12-06` | Valor por defecto seguro | Una celebración nueva nace en `RESTRICTED` en los cuatro modos |

---

## Qué se construye

- `apps/celebration-site-service/src/domain/model/celebration-settings.ts`
- `apps/celebration-site-service/src/application/command/update-settings.ts`
- `apps/celebration-site-service/src/domain/event/celebration-settings-updated.ts`
- `packages/contracts-asyncapi/celebration/settings-updated.v1.yaml`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Value object `CelebrationSettings` con sus cuatro modos y valores por defecto.
2. Comando de actualización con autorización por rol.
3. Evento publicado por outbox y documentado en AsyncAPI.
4. Pruebas de no-retroactividad acordadas con Miguel y Fabio.

---

## Plan de pruebas

- **Test de no-retroactividad**: 3 pendientes, cambio a AUTO_ACCEPT, siguen pendientes.
- Test de autorización: anfitrión 200, planner de la organización 200, otro usuario 403.
- Test de que el evento sale por outbox con el payload exacto del contrato.
- Test de valores por defecto en una celebración recién creada.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Miguel y Fabio confirman por escrito que el payload del evento les sirve.
- [ ] El contrato del evento está publicado antes del viernes de la semana 2.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-12/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Es el carril del que dependen otros dos ejes. Si se atrasa un día, se atrasan dos personas.
- La tentación de «drenar» las pendientes al pasar a AUTO_ACCEPT parece amable y en realidad sorprende al anfitrión aprobando cosas que no miró.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 12 completo
```

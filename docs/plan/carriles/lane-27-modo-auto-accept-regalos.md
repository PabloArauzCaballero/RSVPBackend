# Carril 27 · Modo AUTO_ACCEPT en regalos

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `apps/gift-list-service` |
| **Predecesores** | 26 · 12 (Leo) |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Cuando el anfitrión no quiere revisar cada reserva, la solicitud salta la bandeja y el regalo queda comprometido en el acto. El modo se evalúa en el instante de la solicitud, y cambiarlo después no toca nada de lo ya resuelto.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-27-01` | Consumidor de `CelebrationSettingsUpdated.v1` con caché local | Idempotente y con valor seguro por defecto |
| `REQ-27-02` | Con `AUTO_ACCEPT` la solicitud va directo a `COMMITTED` | Se emite `GiftReservationAutoCommitted.v1` |
| `REQ-27-03` | Con `RESTRICTED` la solicitud queda `PENDING_REVIEW` | Se emite `GiftReservationRequested.v1` y se notifica al anfitrión |
| `REQ-27-04` | **Cambiar el modo no es retroactivo** | Con 3 solicitudes pendientes, pasar a AUTO_ACCEPT las deja pendientes |
| `REQ-27-05` | La concurrencia sigue protegida en ambos modos | 20 simultáneas en AUTO_ACCEPT siguen dando un solo ganador |
| `REQ-27-06` | Si el modo no se conoce todavía, se asume `RESTRICTED` | El valor seguro, nunca el permisivo |

---

## Qué se construye

- `apps/gift-list-service/src/interface/consumer/celebration-settings.consumer.ts`
- `apps/gift-list-service/src/domain/policy/reservation-mode.ts`
- `apps/gift-list-service/src/domain/event/gift-reservation-auto-committed.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Reservar un regalo con AUTO_ACCEPT y observar aprobación automática; contrastar modo manual.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-27-01, REQ-27-02, REQ-27-03, REQ-27-04, REQ-27-05, REQ-27-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F22 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F22 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Consumidor de ajustes, idempotente y con valor por defecto seguro.
2. Política de modo aplicada en el comando de solicitud.
3. Evento de compromiso automático y su contrato AsyncAPI.
4. Pruebas de no-retroactividad y de concurrencia en ambos modos.

---

## Plan de pruebas

- **No-retroactividad**: 3 pendientes, cambio a AUTO_ACCEPT, siguen 3 pendientes.
- 20 concurrentes en modo AUTO_ACCEPT: un solo ganador.
- Modo desconocido: se comporta como RESTRICTED.
- Idempotencia del consumidor de ajustes.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El comportamiento con el modo ausente está probado, no solo documentado.
- [ ] Leo confirma que el payload del evento de ajustes cubre lo que necesitás.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-27/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Asumir AUTO_ACCEPT cuando falta el dato compromete regalos sin permiso del anfitrión. El valor por defecto es una decisión de seguridad.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 27 completo
```

# Carril 04 · Outbox e inbox idempotente

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `packages/platform-outbox` |
| **Predecesores** | 03 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Garantizar que un evento se publica si y solo si la transacción que lo generó hizo commit, y que un consumidor que recibe el mismo evento varias veces produce un solo efecto. Es la pieza de la que depende la corrección de todo el sistema.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-04-01` | El evento se escribe en `outbox_event` dentro de la misma transacción del agregado | Si el commit falla, no queda ninguna fila de outbox |
| `REQ-04-02` | El relay publica con `FOR UPDATE SKIP LOCKED` en lotes | Dos relays corriendo a la vez no publican el mismo evento dos veces |
| `REQ-04-03` | Backoff exponencial y marcado `FAILED` tras N intentos | Un broker caído acumula reintentos y luego alerta, sin perder nada |
| `REQ-04-04` | **El evento sobrevive a la caída del proceso** | Matar el proceso entre el commit y el publish; al reiniciar, el evento sale igual |
| `REQ-04-05` | Inbox idempotente con `event_id` como clave primaria | Entregar el mismo evento 3 veces produce exactamente 1 efecto |
| `REQ-04-06` | El relay no bloquea el camino de escritura | Un comando responde sin esperar a que el evento se publique |

---

## Qué se construye

- `packages/platform-outbox/src/outbox/`
- `packages/platform-outbox/src/relay/`
- `packages/platform-outbox/src/inbox/`
- `packages/platform-outbox/prisma/migrations/`
- `packages/platform-outbox/test/`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Guardar un cambio y su outbox en una transacción; relay y consumidor observables con redelivery idempotente.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-04-01, REQ-04-02, REQ-04-03, REQ-04-04, REQ-04-05, REQ-04-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** sin pareja directa; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar sin pareja directa si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Tabla y repositorio de outbox, con escritura dentro de la transacción del agregado.
2. Relay con `SKIP LOCKED`, lotes y backoff exponencial.
3. Inbox idempotente y decorador de consumidor que lo aplica.
4. Pruebas de resiliencia: caída del proceso, broker caído y dos relays simultáneos.

---

## Plan de pruebas

- **Test de caída**: proceso terminado con `SIGKILL` entre commit y publish; al reiniciar el evento se publica.
- Test de broker caído: parar RabbitMQ, ejecutar comandos, levantarlo, y verificar que todo lo retenido sale.
- Test de dos relays concurrentes sobre la misma tabla: cero duplicados.
- Test de idempotencia: el mismo `eventId` entregado 3 veces deja un solo registro de efecto.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La librería se adopta sin cambios desde un servicio de ejemplo y se documenta cómo replicarla en Spring y Django.
- [ ] Métrica de lag del outbox expuesta a Prometheus.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-04/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Es el carril que menos prisa tolera del proyecto. Un bug sutil acá se hereda en los siete servicios.
- La tentación de publicar «justo después del commit» sin outbox reaparece cada vez que alguien tiene prisa. No es equivalente.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 04 completo
```

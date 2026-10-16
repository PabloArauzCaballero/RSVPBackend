# Carril 34 · Disponibilidad del proveedor

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [07](../calendario/semana-07.md) · 30 de noviembre al 4 de diciembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 30 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Para el partner que no tiene web propia, el microsite necesita mostrar cuándo está libre. Reglas recurrentes, bloqueos puntuales y capacidad por día, todo evaluado en la zona horaria del proveedor.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-34-01` | `ProviderAvailability` con reglas recurrentes | Lunes a sábado de 08:00 a 20:00, por ejemplo |
| `REQ-34-02` | Bloqueos puntuales y por rango | Un día o una semana completa marcados como no disponibles |
| `REQ-34-03` | `capacityPerDay` por proveedor | Cuántos eventos puede tomar el mismo día |
| `REQ-34-04` | **Todo se evalúa en la `timeZone` del proveedor** | Un consultante en otra zona ve los días correctos |
| `REQ-34-05` | Cálculo de días disponibles para un mes | Una consulta devuelve el calendario completo |
| `REQ-34-06` | `ProviderAvailabilityUpdated.v1` por outbox | Alimenta `read_provider_calendar` |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/provider-availability.ts`
- `apps/provider-catalog-service/src/domain/policy/availability-calculator.ts`
- `apps/provider-catalog-service/src/application/query/get-calendar.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Bloquear una franja horaria y observar que desaparece de la disponibilidad pública.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-34-01, REQ-34-02, REQ-34-03, REQ-34-04, REQ-34-05, REQ-34-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F26 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F26 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Modelo de reglas recurrentes y bloqueos.
2. Calculadora de disponibilidad como función pura.
3. Consulta de calendario mensual.
4. Proyección `read_provider_calendar` y su evento.

---

## Plan de pruebas

- Reglas recurrentes evaluadas en `America/La_Paz` con servidor en UTC.
- Bloqueo que cruza medianoche en la zona del proveedor.
- Capacidad por día agotada: el día deja de ofrecerse.
- Mes con cambio de horario de verano.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La calculadora es pura y se prueba sin base de datos.
- [ ] El calendario de un mes se resuelve en una sola consulta.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-34/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Evaluar la disponibilidad con la zona del servidor produce días corridos para proveedores de otro huso. Es el mismo error que el del plazo de RSVP.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 34 completo
```

# Carril 06 · Telemetría y trazabilidad

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `packages/platform-telemetry` |
| **Predecesores** | 05 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Que una sola traza cubra el camino completo de una acción: la petición HTTP que entra por Kong, la escritura en outbox, la publicación al broker, el consumo en otro servicio y la notificación que sale. Sin esto, depurar un sistema de siete servicios es adivinar.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-06-01` | OpenTelemetry instrumentado en los 5 NestJS, con guía para Spring y Django | Los tres runtimes envían al mismo Collector |
| `REQ-06-02` | `correlationId` nace en Kong y llega al consumidor | Una traza en Tempo muestra HTTP, outbox, broker y consumidor como un solo árbol |
| `REQ-06-03` | Logs JSON estructurados con la PII redactada | Un email o un teléfono nunca aparecen en claro en un log |
| `REQ-06-04` | Métricas de negocio además de las técnicas | `leads_por_dia` y `lag_outbox` visibles en Prometheus |
| `REQ-06-05` | Dashboards provisionados como código | Grafana arranca con los 5 dashboards ya cargados |
| `REQ-06-06` | Alerta cuando la cola de aparcamiento deja de estar vacía | Un mensaje aparcado dispara la alerta en menos de un minuto |

---

## Qué se construye

- `packages/platform-telemetry/src/tracing/`
- `packages/platform-telemetry/src/logging/`
- `packages/platform-telemetry/src/metrics/`
- `packages/platform-telemetry/src/redaction/`
- `infra/observability/grafana/dashboards/`
- `docs/runbooks/observabilidad.md`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Seguir una petición real con correlationId desde la entrada hasta un span del servicio y un log sin PII.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-06-01, REQ-06-02, REQ-06-03, REQ-06-04, REQ-06-05, REQ-06-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** sin pareja directa; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar sin pareja directa si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Trazas y propagación de contexto por HTTP y por el sobre de evento.
2. Logs estructurados con capa de redacción de PII.
3. Métricas técnicas y de negocio.
4. Dashboards y alertas provisionados como código.

---

## Plan de pruebas

- Test de extremo a extremo que verifica que el `traceId` es el mismo en la petición y en el consumidor.
- Test de redacción: un objeto con email y teléfono se serializa enmascarado.
- Test de que la alerta de aparcamiento se dispara con un mensaje aparcado.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Cualquiera del equipo puede seguir una acción de punta a punta en Tempo sin ayuda.
- [ ] El runbook explica dónde mirar cuando algo falla en producción.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-06/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- La redacción de PII tiene que estar en la capa de serialización, no en cada `logger.info`. Si depende de la disciplina de cada uno, falla.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 06 completo
```

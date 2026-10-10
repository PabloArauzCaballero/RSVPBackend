# Carril 33 · Métricas de partner

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [06](../calendario/semana-06.md) · 23 de noviembre al 27 de noviembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 32 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

La tabla desde la que algún día se va a facturar. Impresiones, clics, tasa de conversión y leads válidos, desglosados por día, categoría y destino. Si no se puede reconstruir, no se puede auditar; y si no se puede auditar, no se puede cobrar.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-33-01` | `read_provider_metrics` proyectada por evento | Impresiones, clics, CTR y leads válidos |
| `REQ-33-02` | Desglose por día, categoría y tipo de destino | El proveedor ve de dónde vienen sus leads |
| `REQ-33-03` | Los inválidos se contabilizan aparte | Totales y facturables se distinguen siempre |
| `REQ-33-04` | Consumo idempotente | El mismo evento 3 veces no infla los contadores |
| `REQ-33-05` | **Reconstrucción por replay con cifras idénticas** | Borrar, reconstruir y comparar número a número |
| `REQ-33-06` | Las impresiones se registran sin penalizar el rendimiento | Agregadas, no una fila por impresión |

---

## Qué se construye

- `apps/provider-catalog-service/src/infrastructure/projection/provider-metrics.projector.ts`
- `apps/provider-catalog-service/src/application/query/get-provider-metrics.ts`
- `apps/provider-catalog-service/prisma/migrations/ (tabla read_provider_metrics)`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Tabla de métricas y su migración.
2. Proyector idempotente de leads y de impresiones.
3. Consulta con desglose por día, categoría y destino.
4. Comando de replay y prueba de reconstrucción.

---

## Plan de pruebas

- **Replay**: borrar, reconstruir, comparar cifra por cifra.
- Idempotencia con el mismo evento 3 veces.
- Separación de leads totales y válidos.
- Consulta con 90 días de datos sin degradarse.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Un proveedor puede auditar sus cifras contra los eventos crudos.
- [ ] El desglose es suficiente para calcular cualquiera de los cuatro modelos de facturación.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-33/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Si las métricas no se pueden reconstruir, cualquier discusión de facturación con un partner se resuelve por confianza en vez de por evidencia.

---

## Preguntas abiertas

Lo que no se puede resolver sin el propietario no se inventa.

- Qué modelo de facturación aplica por defecto y con qué tarifa es una decisión comercial. El backend mide todo lo necesario para cualquiera de los cuatro.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 33 completo
```

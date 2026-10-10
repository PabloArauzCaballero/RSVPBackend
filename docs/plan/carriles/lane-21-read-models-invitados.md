# Carril 21 · Proyecciones de invitados

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `apps/guest-rsvp-service` |
| **Predecesores** | 19 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El anfitrión quiere saber cuántos vienen sin esperar. Dos proyecciones: un resumen agregado para la portada del panel y una lista paginada y filtrable para la gestión.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-21-01` | `read_guest_summary` con confirmados, rechazados, pendientes y acompañantes | La portada del panel se resuelve en una consulta |
| `REQ-21-02` | `read_guest_list` paginada y filtrable por estado, grupo y búsqueda | Una celebración de 500 invitados responde sin degradarse |
| `REQ-21-03` | Proyectadas por evento, no por consulta al modelo de escritura | Las tablas se actualizan al consumir, no al leer |
| `REQ-21-04` | Consumo idempotente | El mismo evento 3 veces deja los contadores idénticos |
| `REQ-21-05` | **Reconstrucción por replay** | Borrar y reconstruir da exactamente los mismos números |
| `REQ-21-06` | Consistencia eventual acotada y documentada | El panel indica cuándo se actualizó por última vez |

---

## Qué se construye

- `apps/guest-rsvp-service/src/infrastructure/projection/guest-summary.projector.ts`
- `apps/guest-rsvp-service/src/infrastructure/projection/guest-list.projector.ts`
- `apps/guest-rsvp-service/src/application/query/`
- `apps/guest-rsvp-service/prisma/migrations/ (tablas read_*)`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Tablas de proyección y migraciones.
2. Proyector del resumen, idempotente.
3. Proyector de la lista con índices para filtro y búsqueda.
4. Comando de replay y pruebas de reconstrucción.

---

## Plan de pruebas

- **Replay**: borrar ambas proyecciones, reconstruir, comparar.
- Idempotencia: el mismo evento 3 veces no duplica contadores.
- Rendimiento con 500 invitados y filtros combinados.
- Consistencia: tras confirmar, el resumen refleja el cambio en el plazo documentado.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Existe un comando operativo de reconstrucción por celebración.
- [ ] Los índices están justificados por un plan de ejecución, no por intuición.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-21/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un contador que se incrementa sin control de idempotencia se desvía lentamente y nadie lo nota hasta que el anfitrión cuenta a mano.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 21 completo
```

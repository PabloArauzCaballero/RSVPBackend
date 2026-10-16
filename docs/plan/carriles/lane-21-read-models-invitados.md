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

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Confirmar un RSVP y ver el conteo actualizado en una proyección, con reentrega idempotente.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-21-01, REQ-21-02, REQ-21-03, REQ-21-04, REQ-21-05, REQ-21-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F17 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F17 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

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
Usa $rsvp-backend-lane para ejecutar el carril 21 completo
```

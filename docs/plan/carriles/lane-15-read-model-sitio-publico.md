# Carril 15 · Read model del sitio público

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [04](../calendario/semana-04.md) · 9 de noviembre al 13 de noviembre de 2026 |
| **Componente** | `apps/celebration-site-service` |
| **Predecesores** | 13 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

La vista pública se lee miles de veces y se escribe pocas. Se proyecta por evento a una tabla denormalizada que responde en una sola consulta, y que se puede reconstruir desde cero si algo se corrompe.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-15-01` | `read_public_celebration` proyectada por evento | Publicar una celebración crea o actualiza su fila de proyección |
| `REQ-15-02` | La consulta pública no toca el modelo de escritura | Una sola lectura resuelve la portada completa |
| `REQ-15-03` | Consumo idempotente | El mismo evento 3 veces deja la proyección idéntica |
| `REQ-15-04` | **Reconstrucción por replay** | Borrar la proyección, reproducir los eventos y obtener exactamente lo mismo |
| `REQ-15-05` | Una celebración no publicada no aparece en la proyección | Pedirla devuelve 404 |
| `REQ-15-06` | La proyección incluye las traducciones del locale pedido | Cambiar el locale no exige una segunda consulta |

---

## Qué se construye

- `apps/celebration-site-service/src/interface/consumer/`
- `apps/celebration-site-service/src/infrastructure/projection/`
- `apps/celebration-site-service/src/application/query/get-public-celebration.ts`
- `apps/celebration-site-service/prisma/migrations/ (tabla read_public_celebration)`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Publicar una celebración y leer su proyección pública por slug; comprobar ausencia de datos privados.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-15-01, REQ-15-02, REQ-15-03, REQ-15-04, REQ-15-05, REQ-15-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F10 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F10 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Tabla de proyección y su migración.
2. Consumidores de los eventos de celebración, idempotentes.
3. Consulta pública en una sola lectura.
4. Comando de replay y su prueba de reconstrucción.

---

## Plan de pruebas

- **Test de replay**: borrar, reconstruir, comparar byte a byte.
- Test de idempotencia del consumidor.
- Test de que una celebración despublicada desaparece de la proyección.
- Test de rendimiento: la portada se resuelve en una sola consulta.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Existe un comando operativo para reconstruir la proyección de una celebración concreta.
- [ ] El runbook explica cuándo y cómo usarlo.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-15/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Una proyección que no se puede reconstruir es una base de datos de segunda clase con los mismos riesgos y ninguna de las garantías.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 15 completo
```

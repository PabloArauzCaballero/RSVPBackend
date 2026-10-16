# Carril 28 · Regalos catalogados y externos

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `apps/gift-list-service` |
| **Predecesores** | 25 · 30 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

La regla comercial del Event Storming: los productos de partners se ofrecen primero y el regalo externo es la última opción, controlada. Es la regla que conecta la lista de regalos con el modelo de negocio.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-28-01` | `source = CATALOGED` referencia un `ProductListing` verificado | Un producto inexistente o de un partner suspendido devuelve 422 |
| `REQ-28-02` | `source = EXTERNAL` exige una URL válida | Una URL malformada devuelve 422 |
| `REQ-28-03` | Con `externalGiftMode = RESTRICTED` el externo nace `PROPOSED` | Requiere aprobación antes de ser visible |
| `REQ-28-04` | Con `AUTO_ACCEPT` el externo nace `AVAILABLE` | Sin fricción adicional |
| `REQ-28-05` | **Los catalogados aparecen antes que los externos** | Verificado en el orden de la respuesta, no en la interfaz |
| `REQ-28-06` | Con `partnerPriorityEnabled` el catálogo de partners se consulta primero | La respuesta incluye sugerencias antes de permitir el externo |

---

## Qué se construye

- `apps/gift-list-service/src/domain/policy/gift-source-policy.ts`
- `apps/gift-list-service/src/application/command/add-cataloged-gift.ts`
- `apps/gift-list-service/src/application/command/propose-external-gift.ts`
- `apps/gift-list-service/src/infrastructure/http/provider-catalog.client.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Crear un regalo catalogado y otro externo; leer ambos con enlace y reglas propias verificadas.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-28-01, REQ-28-02, REQ-28-03, REQ-28-04, REQ-28-05, REQ-28-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F23 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F23 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Cliente al Provider Catalog con verificación por Pact.
2. Alta de regalo catalogado con validación del producto.
3. Alta de regalo externo con los dos modos.
4. Ordenamiento con prioridad de catalogados.

---

## Plan de pruebas

- Producto de partner suspendido: 422.
- Externo con modo RESTRICTED: nace `PROPOSED`.
- **Orden de la respuesta: catalogados primero, verificado programáticamente.**
- Pact del consumidor publicado y verificado por Provider Catalog.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La prioridad de catalogados está probada en el backend, no delegada al frontend.
- [ ] El cliente HTTP a Provider Catalog degrada con elegancia si el servicio no responde.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-28/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Si la prioridad se implementa solo en la interfaz, cualquier otro consumidor del API la pierde. La regla de negocio va en el backend.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 28 completo
```

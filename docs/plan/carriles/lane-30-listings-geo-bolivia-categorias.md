# Carril 30 · Listings, categorías y geografía de Bolivia

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [04](../calendario/semana-04.md) · 9 de noviembre al 13 de noviembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 29 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El contenido del catálogo: servicios y productos, categorizados y ubicados. Bolivia primero, con sus nueve departamentos y sus ciudades, pero con la estructura ya preparada para cualquier país.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-30-01` | `ServiceListing` y `ProductListing` con i18n | Título y descripción traducibles por locale |
| `REQ-30-02` | **Al menos un destino de redirección es obligatorio** | Publicar sin ninguno devuelve 422 |
| `REQ-30-03` | Las once categorías del Event Storming, con traducciones | Salón, catering, fotografía, música, decoración, maquillaje, transporte, invitaciones, wedding planner, hospedaje y luna de miel |
| `REQ-30-04` | Geografía de Bolivia sembrada con fuente citada | Los nueve departamentos y sus ciudades principales |
| `REQ-30-05` | Búsqueda y orden por cercanía | Probado con tres ciudades distintas |
| `REQ-30-06` | `currency` por proveedor, `BOB` por defecto | Un proveedor extranjero puede usar otra moneda |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/service-listing.ts`
- `apps/provider-catalog-service/src/domain/model/product-listing.ts`
- `apps/provider-catalog-service/src/domain/model/provider-category.ts`
- `apps/provider-catalog-service/prisma/seed/geo-bolivia.ts`
- `apps/provider-catalog-service/prisma/seed/categories.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Publicar un listing válido de una ciudad boliviana y hallarlo por categoría y ciudad.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-30-01, REQ-30-02, REQ-30-03, REQ-30-04, REQ-30-05, REQ-30-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F24 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F24 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Modelos de listing con destinos de redirección obligatorios.
2. Categorías y sus traducciones, sembradas.
3. Geografía de Bolivia sembrada, con la fuente citada en el propio seed.
4. Búsqueda con filtro y orden geográfico.

---

## Plan de pruebas

- Publicar un listing sin destinos: 422 con el campo señalado.
- Búsqueda desde Santa Cruz, La Paz y Cochabamba con resultados ordenados por cercanía.
- Traducción de categorías en `es-BO` y `en-US`.
- Fuga cross-tenant donde aplique.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El seed de geografía cita su fuente; no hay datos inventados.
- [ ] Añadir un país nuevo no exige cambiar el modelo.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-30/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Inventar coordenadas o listas de ciudades «para probar» deja datos falsos que después nadie distingue de los reales. Si no hay fuente, se marca `UNKNOWN`.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 30 completo
```

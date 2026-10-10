# Carril 36 · Cotización y logística declarada

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [08](../calendario/semana-08.md) · 7 de diciembre al 11 de diciembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 35 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Cerrar el marketplace. El visitante arma una selección y pide presupuesto, lo que genera un lead mucho más valioso que un clic. Y cada listing declara quién se responsabiliza del traslado y la entrega: el partner o el cliente, nunca la plataforma.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-36-01` | `QuoteRequest` con items, fecha del evento, invitados, presupuesto y contacto | Genera un lead de tipo formulario |
| `REQ-36-02` | `QuoteRequested.v1` por outbox y notificación al proveedor | El partner lo recibe por su canal preferido |
| `REQ-36-03` | **`fulfillment` obligatorio para publicar un listing** | Publicar sin él devuelve 422 |
| `REQ-36-04` | `fulfillment` declara responsable, cobertura, costo de traslado, plazos y condiciones | Estructurado y traducible, no texto libre |
| `REQ-36-05` | Filtrable por zona de cobertura | Buscar en Cochabamba no devuelve partners que solo cubren Santa Cruz |
| `REQ-36-06` | El deslinde de responsabilidad de la plataforma es parte del contrato de datos | Viaja en la respuesta, no se añade en la interfaz |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/quote-request.ts`
- `apps/provider-catalog-service/src/domain/model/fulfillment.ts`
- `apps/provider-catalog-service/src/application/command/request-quote.ts`
- `apps/provider-catalog-service/src/domain/policy/coverage-filter.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Value object `fulfillment` y su obligatoriedad al publicar.
2. Filtro por zona de cobertura en la búsqueda.
3. Agregado `QuoteRequest` y su comando.
4. Evento, notificación al proveedor y lead de tipo formulario.

---

## Plan de pruebas

- Publicar un listing sin `fulfillment`: 422 con el campo señalado.
- Búsqueda filtrada por cobertura con tres ciudades.
- Cotización con items de varios listings del mismo proveedor.
- El deslinde aparece en la respuesta del API, no solo en la interfaz.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La plataforma no registra ningún estado de entrega ni transporte: solo declara condiciones.
- [ ] El texto del deslinde está revisado y es el mismo en todos los puntos donde aparece.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-36/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Si la plataforma empieza a registrar estados de entrega, empieza a parecer responsable de la entrega. El alcance es declarativo y conviene no erosionarlo.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 36 completo
```

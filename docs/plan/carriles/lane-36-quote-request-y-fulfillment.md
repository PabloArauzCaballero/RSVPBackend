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

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Pedir una cotización y consultar su estado, incluyendo una respuesta inválida del proveedor.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-36-01, REQ-36-02, REQ-36-03, REQ-36-04, REQ-36-05, REQ-36-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F26 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F26 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

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
Usa $rsvp-backend-lane para ejecutar el carril 36 completo
```

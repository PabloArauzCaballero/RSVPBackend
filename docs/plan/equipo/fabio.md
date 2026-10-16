> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Fabio · Eje D — El negocio

> Tu eje es el que paga el proyecto. Todo lo demás existe para generar el tráfico que termina en un clic hacia un partner. Tenés 12 carriles de backend, más que nadie, porque Gift List y Provider Catalog son dos dominios completos y porque el marketplace sumó la agenda del proveedor.

---

## Lo que te pertenece

| | |
|---|---|
| **Servicios** | Gift List Service (NestJS), Provider Catalog Service (NestJS) |
| **Bases de datos** | `gift_db`, `provider_db` |
| **Conceptos clave** | `GiftItem`, `GiftReservation`, `Provider`, `ServiceListing`, `ProductListing`, **`Lead`**, `leadConfig`, `computeListingScore`, `ProviderAvailability`, `BookingRequest`, `QuoteRequest`, `fulfillment` |
| **Frontend** | Lista de regalos pública, microsite del partner, cotización y agenda, redirección y atribución, portal del proveedor |

---

## El negocio, en una frase

La plataforma no cobra bodas ni procesa pagos: **gana cuando alguien hace clic hacia un partner y ese clic se puede contar, atribuir y facturar.** Por eso ningún enlace a un proveedor sale directo: todos pasan por `/r/{listingId}`, que registra el `Lead`, inyecta UTM y responde `302`.

---

## Tu calendario

| Semana | Fechas | Carriles | Foco |
|---|---|---|---|
| 00 | 12–16 oct | — | Contract Freeze. Definís el contrato de `Lead` y el de productos catalogados que consume Gift List |
| 01 | 19–23 oct | [25](../carriles/lane-25-gift-list-dominio.md) | Dominio de la lista de regalos |
| 02 | 26–30 oct | [26](../carriles/lane-26-reserva-concurrencia-y-aprobacion.md) | **Concurrencia de reserva**: 20 simultáneas, 1 gana |
| 03 | 2–6 nov | [27](../carriles/lane-27-modo-auto-accept-regalos.md) · [28](../carriles/lane-28-regalos-catalogados-vs-externos.md) | Modo AUTO/RESTRICTED y catalogados vs externos |
| 04 | 9–13 nov | [29](../carriles/lane-29-provider-onboarding-y-verificacion.md) · [30](../carriles/lane-30-listings-geo-bolivia-categorias.md) | Alta de proveedor y listings con geo Bolivia |
| 05 | 16–20 nov | [31](../carriles/lane-31-motor-de-redireccion-y-leads.md) · [32](../carriles/lane-32-lead-config-dedupe-y-ranking.md) | **El motor de leads y el ranking** |
| 06 | 23–27 nov | [33](../carriles/lane-33-read-model-metricas-partner.md) | Métricas de partner |
| 07 | 30 nov – 4 dic | [34](../carriles/lane-34-provider-availability.md) · [35](../carriles/lane-35-booking-request-concurrencia.md) | Disponibilidad y reserva de fecha |
| 08 | 7–11 dic | [36](../carriles/lane-36-quote-request-y-fulfillment.md) | Cotización y logística declarada |
| 09 | 14–18 dic | F22 | Lista de regalos pública |
| 10 🎄 | 21–25 dic | F25 | Microsite del partner |
| 11 🎄 | 28 dic – 1 ene | F26 | Cotización y agenda en el microsite |
| 12 | 4–8 ene | F27 | Redirección y atribución en el front |
| 13 | 11–15 ene | F28 | Portal del proveedor + estabilización |

---

## Tus carriles de backend

| # | Carril | Entregable que lo cierra |
|---|---|---|
| [25](../carriles/lane-25-gift-list-dominio.md) | Dominio de regalos | Máquina de estados completa en tests unitarios puros |
| [26](../carriles/lane-26-reserva-concurrencia-y-aprobacion.md) | Concurrencia | **20 concurrentes: 1 → 201, 19 → 409. Repetido 10 veces sin flake** |
| [27](../carriles/lane-27-modo-auto-accept-regalos.md) | AUTO_ACCEPT | Con 3 pendientes, cambiar a AUTO_ACCEPT **no** las drena |
| [28](../carriles/lane-28-regalos-catalogados-vs-externos.md) | Catalogados vs externos | Externo con modo RESTRICTED nace `PROPOSED`; catalogados primero en el orden |
| [29](../carriles/lane-29-provider-onboarding-y-verificacion.md) | Onboarding de partner | Solo `VERIFIED` aparece en búsqueda |
| [30](../carriles/lane-30-listings-geo-bolivia-categorias.md) | Listings y geo | **≥1 destino de redirección o 422**; geo Bolivia sembrada con fuente citada |
| [31](../carriles/lane-31-motor-de-redireccion-y-leads.md) | **Motor de leads** | `302` (nunca 301), UTM y `correlationId` en la URL final, `Lead` persistido |
| [32](../carriles/lane-32-lead-config-dedupe-y-ranking.md) | Dedupe y ranking | Dup → `INVALID`; bot → `INVALID`; cap agotado baja ranking pero **no** oculta |
| [33](../carriles/lane-33-read-model-metricas-partner.md) | Métricas | Replay reconstruye cifras idénticas |
| [34](../carriles/lane-34-provider-availability.md) | Disponibilidad | Reglas recurrentes, blackouts y capacidad, en la tz del partner |
| [35](../carriles/lane-35-booking-request-concurrencia.md) | Reserva de fecha | **20 concurrentes al último cupo: 1 → 201, 19 → 409** |
| [36](../carriles/lane-36-quote-request-y-fulfillment.md) | Cotización y fulfillment | `fulfillment` obligatorio o 422; filtrable por zona de cobertura |

---

## Lo que esperás de los demás

| De quién | Qué | Para cuándo |
|---|---|---|
| Leo | `CelebrationSettings` con `giftReservationMode`, `externalGiftMode`, `partnerPriorityEnabled` | fin semana 02 — te bloquea el carril 27 |
| Pablo | `platform-outbox` con lock optimista probado | fin semana 02 — te bloquea el carril 26 |
| Pablo | Rate limiting en Kong para `/r/*` | fin semana 05 — te bloquea el carril 31 |
| Miguel | Notification consumiendo tus eventos de reserva | fin semana 05 |

---

## Riesgos de tu eje

- **Tenés 12 carriles de backend; el que más.** Si algo se atrasa, el colchón de Pablo en las semanas 9–13 es para vos antes que para nadie. Decilo temprano.
- **La concurrencia no se prueba con mocks.** Los carriles 26 y 35 necesitan Postgres real y peticiones realmente simultáneas. Un test que pasa con un mock de repositorio no prueba nada.
- **`301` en lugar de `302` mata el negocio en silencio.** El navegador cachea el 301 y los clics siguientes del mismo usuario nunca llegan al servidor: dejás de contar leads sin que falle nada. Es la línea de código más cara del proyecto.
- **El cap mensual baja el ranking, no oculta el listing.** Ocultarlo rompe la experiencia del usuario y la relación con el partner. Está en el test.

# Carriles · RSVP Backend

**Orden vigente:** [revisión de slices verticales](../revision-vertical-slice-2026-10-16.md). Cada ficha tiene un primer corte específico; el antiguo plan por componentes es inventario. CodeGraph sustituye Graphify y los gates visuales/motion se aplican donde correspondan.

36 órdenes de trabajo. Cada carril es una unidad de ejecución con dueño, semana, requisitos falsables y Definition of Done propio.

**Ejecución obligatoria:** al trabajar un carril, aplica [`$rsvp-backend-lane`](../../../.agents/skills/rsvp-backend-lane/SKILL.md) y las [convenciones de código](../../engineering/convenciones.md). Si cambia API o evento, aplica también [`$rsvp-backend-contract-proof`](../../../.agents/skills/rsvp-backend-contract-proof/SKILL.md). `AGENTS.md` fija esta regla para agentes; el cumplimiento humano requiere revisión y checks de CI. Las fichas conservan su alcance específico.

---

## Todos los carriles

| # | Carril | Responsable | Semana | Predecesores |
|---|---|---|---|---|
| `01` | [Monorepo y toolchain](lane-01-monorepo-y-toolchain.md) | Pablo | [01](../calendario/semana-01.md) | Contract Freeze (semana 00) |
| `02` | [Infraestructura local](lane-02-infra-local-docker-compose.md) | Pablo | [01](../calendario/semana-01.md) | 01 |
| `03` | [Mensajería RabbitMQ](lane-03-platform-messaging-rabbitmq.md) | Pablo | [02](../calendario/semana-02.md) | 02 |
| `04` | [Outbox e inbox idempotente](lane-04-platform-outbox-inbox.md) | Pablo | [02](../calendario/semana-02.md) | 03 |
| `05` | [Autenticación y contexto de tenant](lane-05-platform-auth-tenant-context.md) | Pablo | [03](../calendario/semana-03.md) | 04 |
| `06` | [Telemetría y trazabilidad](lane-06-platform-telemetry.md) | Pablo | [03](../calendario/semana-03.md) | 05 |
| `07` | [Identity Service](lane-07-identity-service.md) | Pablo | [04](../calendario/semana-04.md) | 05 |
| `08` | [API Gateway declarativo](lane-08-api-gateway-kong.md) | Pablo | [05](../calendario/semana-05.md) | 07 |
| `09` | [CI/CD y Pact Broker](lane-09-ci-cd-y-pact-broker.md) | Pablo | [05](../calendario/semana-05.md) | 08 |
| `10` | [Dominio de Celebration y tenancy](lane-10-celebration-dominio-y-tenancy.md) | Leo | [01](../calendario/semana-01.md) | Contract Freeze |
| `11` | [Tipos de evento dirigidos por datos](lane-11-event-type-definition-multievento.md) | Leo | [02](../calendario/semana-02.md) | 10 |
| `12` | [Modos AUTO_ACCEPT y RESTRICTED](lane-12-celebration-settings-auto-restricted.md) | Leo | [02](../calendario/semana-02.md) | 10 |
| `13` | [Publicación validada por tipo](lane-13-publicacion-y-validacion.md) | Leo | [03](../calendario/semana-03.md) | 11 |
| `14` | [Internacionalización, timezone y moneda](lane-14-i18n-timezone-moneda.md) | Leo | [03](../calendario/semana-03.md) | 10 |
| `15` | [Read model del sitio público](lane-15-read-model-sitio-publico.md) | Leo | [04](../calendario/semana-04.md) | 13 |
| `16` | [Templates y media en Django](lane-16-template-media-django.md) | Leo | [05](../calendario/semana-05.md) | 11 |
| `17` | [Invitados y grupos familiares](lane-17-guest-y-grupos.md) | Miguel | [01](../calendario/semana-01.md) | Contract Freeze |
| `18` | [Tokens de acceso del invitado](lane-18-tokens-de-acceso-invitado.md) | Miguel | [02](../calendario/semana-02.md) | 17 |
| `19` | [RSVP: confirmación y edición](lane-19-rsvp-confirmacion-y-edicion.md) | Miguel | [02](../calendario/semana-02.md) | 18 · 12 (Leo) |
| `20` | [Acompañantes y asistentes no registrados](lane-20-acompanantes-y-no-registrados.md) | Miguel | [03](../calendario/semana-03.md) | 19 · 12 (Leo) |
| `21` | [Proyecciones de invitados](lane-21-read-models-invitados.md) | Miguel | [03](../calendario/semana-03.md) | 19 |
| `22` | [Derecho al olvido](lane-22-gdpr-derecho-al-olvido.md) | Miguel | [04](../calendario/semana-04.md) | 21 |
| `23` | [Notificaciones: hexágono y canales](lane-23-notification-hexagonal-canales.md) | Miguel | [05](../calendario/semana-05.md) | 04 |
| `24` | [Push en iOS y Android](lane-24-push-ios-android-expo.md) | Miguel | [06](../calendario/semana-06.md) | 23 |
| `25` | [Dominio de la lista de regalos](lane-25-gift-list-dominio.md) | Fabio | [01](../calendario/semana-01.md) | Contract Freeze |
| `26` | [Reserva de regalo y concurrencia](lane-26-reserva-concurrencia-y-aprobacion.md) | Fabio | [02](../calendario/semana-02.md) | 25 · 04 (Pablo) |
| `27` | [Modo AUTO_ACCEPT en regalos](lane-27-modo-auto-accept-regalos.md) | Fabio | [03](../calendario/semana-03.md) | 26 · 12 (Leo) |
| `28` | [Regalos catalogados y externos](lane-28-regalos-catalogados-vs-externos.md) | Fabio | [03](../calendario/semana-03.md) | 25 · 30 |
| `29` | [Alta y verificación de proveedores](lane-29-provider-onboarding-y-verificacion.md) | Fabio | [04](../calendario/semana-04.md) | Contract Freeze |
| `30` | [Listings, categorías y geografía de Bolivia](lane-30-listings-geo-bolivia-categorias.md) | Fabio | [04](../calendario/semana-04.md) | 29 |
| `31` | [Motor de redirección y leads](lane-31-motor-de-redireccion-y-leads.md) | Fabio | [05](../calendario/semana-05.md) | 30 · 08 (Pablo) |
| `32` | [Configuración de leads, deduplicación y ranking](lane-32-lead-config-dedupe-y-ranking.md) | Fabio | [05](../calendario/semana-05.md) | 31 |
| `33` | [Métricas de partner](lane-33-read-model-metricas-partner.md) | Fabio | [06](../calendario/semana-06.md) | 32 |
| `34` | [Disponibilidad del proveedor](lane-34-provider-availability.md) | Fabio | [07](../calendario/semana-07.md) | 30 |
| `35` | [Reserva de fecha y concurrencia](lane-35-booking-request-concurrencia.md) | Fabio | [07](../calendario/semana-07.md) | 34 |
| `36` | [Cotización y logística declarada](lane-36-quote-request-y-fulfillment.md) | Fabio | [08](../calendario/semana-08.md) | 35 |

---

## Por responsable

### [Pablo](../equipo/pablo.md) · 9 carriles

- `01` [Monorepo y toolchain](lane-01-monorepo-y-toolchain.md) — semana 01
- `02` [Infraestructura local](lane-02-infra-local-docker-compose.md) — semana 01
- `03` [Mensajería RabbitMQ](lane-03-platform-messaging-rabbitmq.md) — semana 02
- `04` [Outbox e inbox idempotente](lane-04-platform-outbox-inbox.md) — semana 02
- `05` [Autenticación y contexto de tenant](lane-05-platform-auth-tenant-context.md) — semana 03
- `06` [Telemetría y trazabilidad](lane-06-platform-telemetry.md) — semana 03
- `07` [Identity Service](lane-07-identity-service.md) — semana 04
- `08` [API Gateway declarativo](lane-08-api-gateway-kong.md) — semana 05
- `09` [CI/CD y Pact Broker](lane-09-ci-cd-y-pact-broker.md) — semana 05

### [Leo](../equipo/leo.md) · 7 carriles

- `10` [Dominio de Celebration y tenancy](lane-10-celebration-dominio-y-tenancy.md) — semana 01
- `11` [Tipos de evento dirigidos por datos](lane-11-event-type-definition-multievento.md) — semana 02
- `12` [Modos AUTO_ACCEPT y RESTRICTED](lane-12-celebration-settings-auto-restricted.md) — semana 02
- `13` [Publicación validada por tipo](lane-13-publicacion-y-validacion.md) — semana 03
- `14` [Internacionalización, timezone y moneda](lane-14-i18n-timezone-moneda.md) — semana 03
- `15` [Read model del sitio público](lane-15-read-model-sitio-publico.md) — semana 04
- `16` [Templates y media en Django](lane-16-template-media-django.md) — semana 05

### [Miguel](../equipo/miguel.md) · 8 carriles

- `17` [Invitados y grupos familiares](lane-17-guest-y-grupos.md) — semana 01
- `18` [Tokens de acceso del invitado](lane-18-tokens-de-acceso-invitado.md) — semana 02
- `19` [RSVP: confirmación y edición](lane-19-rsvp-confirmacion-y-edicion.md) — semana 02
- `20` [Acompañantes y asistentes no registrados](lane-20-acompanantes-y-no-registrados.md) — semana 03
- `21` [Proyecciones de invitados](lane-21-read-models-invitados.md) — semana 03
- `22` [Derecho al olvido](lane-22-gdpr-derecho-al-olvido.md) — semana 04
- `23` [Notificaciones: hexágono y canales](lane-23-notification-hexagonal-canales.md) — semana 05
- `24` [Push en iOS y Android](lane-24-push-ios-android-expo.md) — semana 06

### [Fabio](../equipo/fabio.md) · 12 carriles

- `25` [Dominio de la lista de regalos](lane-25-gift-list-dominio.md) — semana 01
- `26` [Reserva de regalo y concurrencia](lane-26-reserva-concurrencia-y-aprobacion.md) — semana 02
- `27` [Modo AUTO_ACCEPT en regalos](lane-27-modo-auto-accept-regalos.md) — semana 03
- `28` [Regalos catalogados y externos](lane-28-regalos-catalogados-vs-externos.md) — semana 03
- `29` [Alta y verificación de proveedores](lane-29-provider-onboarding-y-verificacion.md) — semana 04
- `30` [Listings, categorías y geografía de Bolivia](lane-30-listings-geo-bolivia-categorias.md) — semana 04
- `31` [Motor de redirección y leads](lane-31-motor-de-redireccion-y-leads.md) — semana 05
- `32` [Configuración de leads, deduplicación y ranking](lane-32-lead-config-dedupe-y-ranking.md) — semana 05
- `33` [Métricas de partner](lane-33-read-model-metricas-partner.md) — semana 06
- `34` [Disponibilidad del proveedor](lane-34-provider-availability.md) — semana 07
- `35` [Reserva de fecha y concurrencia](lane-35-booking-request-concurrencia.md) — semana 07
- `36` [Cotización y logística declarada](lane-36-quote-request-y-fulfillment.md) — semana 08

---

## Qué contiene cada ficha

| Sección | Para qué sirve |
|---|---|
| **Objetivo** | Por qué existe este carril y qué cambia cuando está hecho |
| **Requisitos** | Cada `REQ` con su forma de demostrarlo. Falsable: o pasa su prueba, o no pasa |
| **Qué se construye** | Los archivos y módulos que salen de este carril |
| **Plan por slices** | El orden. Cada slice termina con sus pruebas en verde antes del siguiente |
| **Plan de pruebas** | Los casos concretos, incluidos los de concurrencia y los de fuga cross-tenant |
| **Definition of Done** | Lo específico del carril, más el DoD general que aplica a todos |
| **Riesgos** | Las trampas conocidas. Se leen antes de empezar, no después de caer |
| **Preguntas abiertas** | Lo que no se puede resolver sin el propietario. No se inventa |

---

## Estados posibles

`NOT_STARTED` → `IN_PROGRESS` → `IMPLEMENTED` → `TESTED` → `REGRESSION_VERIFIED` → `DONE`

Un requisito queda en `PASS` o en `BLOCKED-EXTERNAL` con evidencia concreta.
**`PARTIAL` no permite cerrar un carril.** O se termina, o se declara bloqueado con una razón que otra persona pueda verificar.

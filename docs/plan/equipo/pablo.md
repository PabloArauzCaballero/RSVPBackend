# Pablo · Eje A — Plataforma + Identity

> Sos el primero y el cuello de botella. Tus carriles `01`–`05` y `F01`–`F05` son predecesores de casi todo lo que hacen los otros tres. Si vos te atrasás, se atrasa el proyecto entero; si vos vas adelantado, los demás trabajan sin fricción.

---

## Lo que te pertenece

| | |
|---|---|
| **Servicios** | API Gateway (Kong), Identity Service (Spring Boot / Java 21) |
| **Packages** | `platform-messaging`, `platform-outbox`, `platform-telemetry`, `platform-auth`, `platform-testing`, todos los `config-*` |
| **Infraestructura** | `docker-compose.yml`, `kong.yml`, `rabbitmq/definitions.json`, stack de observabilidad, `postgres/init` con RLS |
| **Transversal** | CI/CD en GitHub Actions, Pact Broker, EAS Build |
| **Base de datos** | `identity_db` |

Nadie más toca estos archivos. Si alguien necesita un cambio en `platform-*`, te lo pide y vos lo hacés: así el contrato interno no se fragmenta.

---

## Tu calendario

| Semana | Fechas | Carriles | Foco |
|---|---|---|---|
| 00 | 12–16 oct | — | Contract Freeze con los cuatro. Vos liderás el esqueleto del monorepo y la infra local |
| 01 | 19–23 oct | [01](../carriles/lane-01-monorepo-y-toolchain.md) · [02](../carriles/lane-02-infra-local-docker-compose.md) | Monorepo poliglota y stack local completo |
| 02 | 26–30 oct | [03](../carriles/lane-03-platform-messaging-rabbitmq.md) · [04](../carriles/lane-04-platform-outbox-inbox.md) | Mensajería y entrega garantizada. **Hito H2 depende de vos** |
| 03 | 2–6 nov | [05](../carriles/lane-05-platform-auth-tenant-context.md) · [06](../carriles/lane-06-platform-telemetry.md) | Auth, contexto de tenant y trazabilidad |
| 04 | 9–13 nov | [07](../carriles/lane-07-identity-service.md) | Identity Service completo en Spring Boot |
| 05 | 16–20 nov | [08](../carriles/lane-08-api-gateway-kong.md) · [09](../carriles/lane-09-ci-cd-y-pact-broker.md) | Gateway declarativo y pipelines |
| 06 | 23–27 nov | F01 · F02 · F03 | Turborepo de frontend, design tokens, primitivas de UI |
| 07 | 30 nov – 4 dic | F04 · F05 | Cliente de API, sesión y deep links |
| 08 | 7–11 dic | F06 · F07 | i18n y pipeline de EAS Build |
| 09 | 14–18 dic | — | **Colchón.** Integración, destrabar a los otros tres |
| 10 🎄 | 21–25 dic | — | Refuerzo donde haga falta |
| 11 🎄 | 28 dic – 1 ene | — | Refuerzo donde haga falta |
| 12 | 4–8 ene | — | E2E web globales entrando por Kong |
| 13 | 11–15 ene | — | E2E móvil, builds EAS firmados, cierre |

Las semanas 9 a 13 están vacías **a propósito**. No es holgura: es el seguro del proyecto. Cuando alguien se trabe, vas vos.

---

## Tus carriles de backend

| # | Carril | Entregable que lo cierra |
|---|---|---|
| [01](../carriles/lane-01-monorepo-y-toolchain.md) | Monorepo y toolchain | `yarn turbo run build lint test` verde en los 8 workspaces, Java y Python incluidos |
| [02](../carriles/lane-02-infra-local-docker-compose.md) | Infra local | Un comando levanta Postgres×7, RabbitMQ, Redis, MinIO, Kong y el stack OTel, todos healthy |
| [03](../carriles/lane-03-platform-messaging-rabbitmq.md) | Mensajería | Topología declarativa, publisher con confirms, consumer con retry y DLX |
| [04](../carriles/lane-04-platform-outbox-inbox.md) | Outbox e inbox | Matar el proceso entre commit y publish y que el evento salga igual al reiniciar |
| [05](../carriles/lane-05-platform-auth-tenant-context.md) | Auth y tenant | Guard JWT/JWKS y `TenantContext`; test de fuga cross-tenant |
| [06](../carriles/lane-06-platform-telemetry.md) | Telemetría | Una traza única que cubre HTTP → outbox → broker → consumidor |
| [07](../carriles/lane-07-identity-service.md) | Identity | JWT RS256, JWKS, refresh rotativo con detección de reuso, organizaciones y roles |
| [08](../carriles/lane-08-api-gateway-kong.md) | Kong | `kong.yml` versionado; request sin token → 401 **en el gateway** |
| [09](../carriles/lane-09-ci-cd-y-pact-broker.md) | CI/CD | `turbo --affected`, matriz de 3 runtimes, Pact Broker, gitleaks, 7 imágenes |

---

## Lo que los demás esperan de vos, y cuándo

| Quién | Qué necesita | Para cuándo |
|---|---|---|
| Los tres | `docker compose up` funcionando | fin semana 01 |
| Los tres | `platform-outbox` y `platform-messaging` usables | fin semana 02 |
| Los tres | `platform-auth` con `TenantContext` | fin semana 03 |
| Los tres | Kong enrutando a sus servicios | fin semana 05 |
| Leo | `F01`–`F03` (Turborepo front, tokens, primitivas) | fin semana 06 |
| Miguel | `F05` (deep links y sesión) | fin semana 07 |
| Todos | CI que corre sus tests en cada PR | fin semana 05 |

Si alguna de estas fechas se te va a pasar, avisá **el lunes anterior**, no el viernes.

---

## Riesgos de tu eje

- **Spring Boot es el único servicio en Java.** Si el carril 07 se complica, no hay nadie más que pueda entrar a ayudarte sin perder una semana entendiendo el proyecto. Empezá por el dominio puro y los tests, que no dependen de infraestructura.
- **Kong DB-less es rígido a propósito.** Todo cambio va en `kong.yml` versionado. Si alguien te pide "solo tocá la config un momento", la respuesta es un PR.
- **El outbox es el corazón del sistema.** Si tiene un bug sutil, todos los servicios lo heredan. Es el carril que más test de integración real merece, y el que menos prisa tolera.

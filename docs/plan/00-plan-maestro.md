> **Revisión vigente (16-oct-2026):** [replanificación por slices verticales](revision-vertical-slice-2026-10-16.md). Sus criterios de entrega, CodeGraph, UX/UI y animación prevalecen sobre secuencias por capas y calendario histórico de este documento.

> Plan maestro del backend. Es la referencia estable del proyecto.
> El reparto por persona está en [`equipo/`](equipo/), el calendario en [`calendario/`](calendario/)
> y las órdenes de trabajo en [`carriles/`](carriles/).
> El plan de frontend vive en `RSVPFrontend/docs/plan/`.

> **Nota de ejecución vigente (2026-10-16):** el harness `.claude/` completo, `tareas/` y una skill por carril descritos abajo son el diseño histórico y no están implementados. `.claude/skills/` contiene adaptadores hacia las skills compartidas; sí existen hooks de recarga por prompt para Claude y Gemini. El flujo obligatorio actual está en [`AGENTS.md`](../../AGENTS.md), las skills de [`.agents/skills/`](../../.agents/skills/rsvp-backend-lane/SKILL.md), la [política de skills](../engineering/skills.md), las [convenciones](../engineering/convenciones.md) y las 36 fichas existentes en [`carriles/`](carriles/).

---

# Plan Maestro · Plataforma de Celebraciones (RSVP) · Backend Event-Driven

Monorepo poliglota · DDD + CQRS + Hexagonal · 8 servicios · 4 carriles independientes
Metodología de carriles heredada de **AloVida/ATLAS** (`C:\Users\DELL\Documents\Github\Alovida\tareas`), adaptada a backend.

---

## 1. Contexto

### Qué se construye y por qué

El Event Storming (Proyecto 03) modeló una **plataforma web para bodas** con DDD + CQRS + microservicios. Tres refinamientos posteriores redefinen el alcance:

1. **No es solo bodas.** Cliente internacional: la plataforma soporta **bodas, quinceaños y cualquier evento con la misma peculiaridad** (anfitrión + invitados + RSVP + lista de regalos + proveedores). El agregado raíz deja de llamarse `Wedding` y pasa a ser `Celebration`, con el tipo resuelto **por datos, no por código**.

2. **El negocio está en los partners.** La plataforma **no procesa pagos**. Monetiza catalogando proveedores y productos, dirigiendo demanda hacia ellos y **midiendo leads por redirección** a su landing o página oficial. El Provider Catalog no es "supporting": es el núcleo económico.

3. **El anfitrión configura el nivel de control.** Un switch `AUTO_ACCEPT | RESTRICTED` por celebración decide si las solicitudes se aprueban solas o pasan por su bandeja.

### Estado actual

`RSVPBackend/` y `RSVPFrontend/` clonados y **vacíos** (sin commits). Greenfield total. **Esta entrega es solo backend.**

### Resultado esperado

Un monorepo con **7 servicios + API Gateway**, event-driven con entrega garantizada, arquitectura hexagonal estricta, contratos congelados (OpenAPI 3.1 + AsyncAPI), observabilidad completa, y **33 carriles repartidos en 4 ejes independientes** —Pablo, Leo, Miguel, Fabio— cada uno con su skill de ejecución, Definition of Done y pruebas duras falsables.

---

## 2. El modelo de negocio, explícito

> Esto es lo que paga el proyecto. Todo lo demás existe para generar el tráfico que llega aquí.

**La plataforma no cobra por bodas ni procesa pagos.** Gana dinero porque:

1. Catalogación de partners: proveedores de servicio (salón, catering, fotografía/video, música/DJ, decoración, maquillaje, transporte, invitaciones, wedding planner, hospedaje, luna de miel) y proveedores de producto (lo que va en la lista de regalos).
2. La plataforma concentra una audiencia **de altísima intención**: una pareja organizando su boda y sus 150 invitados buscando qué regalar. Es demanda calificada, con fecha y presupuesto.
3. **El negocio se consuma en la redirección.** Cada vez que alguien hace clic en un partner y la plataforma lo manda a su **landing, sitio oficial, WhatsApp o ficha de producto**, se genera un **Lead** medido, atribuido y facturable.
4. El regalo externo no catalogado es la **última opción**, controlada: siempre se muestran primero los productos de partners.

**Lo que esto exige del backend** (y que el Event Storming no modelaba):

| Necesidad del negocio | Mecanismo técnico |
|---|---|
| El clic debe poder contarse | El frontend **nunca** enlaza directo al partner. Enlaza a `GET /r/{listingId}?destination=...` → **302** con UTM inyectados |
| Saber de dónde vino el lead | `Lead` guarda celebración, invitado/sesión, superficie (sitio público / dashboard / catálogo de regalos / buscador), categoría, geo, device, referrer y `correlationId` |
| No cobrar clics falsos | Dedupe por `(sessionId, listingId, destino)` en ventana configurable + detección de bots → `INVALID`, excluido del conteo facturable |
| Que cada partner configure su canal | `leadConfig`: destinos habilitados, plantilla UTM, ventana de dedupe, `monthlyLeadCap`, modelo (`CPC`/`CPL`/`FLAT`/`REVSHARE`) |
| Que el catálogo no sea basura | Onboarding `DRAFT → PENDING_VERIFICATION → VERIFIED`; solo `VERIFIED` aparece en búsqueda |
| Que los que pagan se vean primero | `computeListingScore`: verificación + plan + geo-match + categoría + completitud de ficha + CTR reciente − cap agotado |
| Poder facturar después | `read_provider_metrics`: impresiones, clics, CTR y leads válidos por día / categoría / destino / partner |

**Bolivia primero**: moneda `BOB` por defecto, departamentos y ciudades sembrados (Santa Cruz, La Paz, Cochabamba, Tarija, Sucre, Oruro, Potosí, Beni, Pando), WhatsApp como destino de primera clase, categorías con vocabulario local. La estructura ya es multi-país y multi-moneda para el cliente internacional.

---

## 3. Decisiones de arquitectura (cerradas)

| # | Decisión | Elección | Consecuencia |
|---|---|---|---|
| D1 | Agregado raíz | `Celebration` + `EventTypeDefinition` en DB | Añadir "Bautizo" = insertar fila + traducciones. Cero deploy |
| D2 | Tenancy | `celebrationId` en toda fila + `organizationId` nullable | Aislamiento verificable por test; cambiar de dueño = 1 UPDATE |
| D3 | Atomicidad dominio↔broker | **Transactional Outbox + relay** | Nunca se pierde un evento; consumo idempotente vía inbox |
| D4 | CQRS | Tablas `read_*` en la DB del propio servicio | CQRS real sin event sourcing; reconstruibles por replay |
| D5 | Broker | Topic exchange **por bounded context** + DLX + parking | `<ctx>.<entidad>.<hecho>.v<N>` |
| D6 | Auth | Identity emite JWT **RS256**; Kong valida con JWKS; servicios revalidan | Defensa en profundidad; refresh opaco en Redis |
| D7 | Identidad del invitado | **Token opaco único por invitado** (magic link) | Sin login; revocable, rastreable, rate-limited |
| D8 | RSVP | Individual, **editable hasta el deadline** | Después → `409 RsvpWindowClosed` |
| D9 | Reserva de regalo | **Una sola `PENDING_REVIEW`** con lock optimista | Segundo solicitante → `409 GiftNotAvailable` |
| D10 | Cambio AUTO↔RESTRICTED | **No retroactivo** | Se evalúa en el instante del comando |
| D11 | Arquitectura interna | **Hexagonal (puertos y adaptadores)**, obligatoria en los 7 | Dominio sin dependencias de framework, verificado por test |
| D12 | Repo | **Turborepo + Yarn 4** poliglota dentro de `RSVPBackend/` | Java y Python como apps no-JS orquestadas por Turbo |
| D13 | Tests | Jest+Supertest (NestJS), JUnit5+RestAssured (Spring), pytest (Django), **Pact** | Mismo DoD y mismo umbral en los tres runtimes |
| D14 | Metodología | **Carriles AloVida/ATLAS** adaptados a backend | Ficha de especificación + skill de ejecución + Claim Ladder + evidencia |

---

## 4. Mapa de servicios

| Servicio | Runtime | Rol | DB | Eje |
|---|---|---|---|---|
| **API Gateway** | Kong DB-less (`kong.yml`) | Routing, JWT, rate-limit, CORS, correlation-id | — | Pablo |
| **Identity Service** | Spring Boot / Java 21 | Usuarios, roles, JWT RS256, JWKS, organizaciones | `identity_db` | Pablo |
| **Celebration Site Service** | NestJS + Prisma | `Celebration`, `EventTypeDefinition`, settings, publicación, i18n | `celebration_db` | Leo |
| **Template / Media Service** | Django + DRF | Templates, assets, uploads MinIO/S3, variantes | `template_db` | Leo |
| **Guest / RSVP Service** | NestJS + Prisma | `Guest`, `GuestGroup`, `Rsvp`, tokens, proyecciones | `guest_db` | Miguel |
| **Notification Service** | NestJS hexagonal estricto | Email, WhatsApp, SMS, **Push iOS/Android** | `notification_db` | Miguel |
| **Gift List Service** | NestJS + Prisma | `GiftList`, `GiftItem`, reservas, aprobación | `gift_db` | Fabio |
| **Provider Catalog Service** | NestJS + Prisma | Partners, listings, productos, **leads y atribución** | `provider_db` | Fabio |

**Regla dura**: ninguna base se comparte. Integración **solo** por evento o por API pública versionada.

---

## 5. Estructura del monorepo

```
RSVPBackend/
├── .claude/                          # ← harness de carriles (§7)
│   ├── CLAUDE.md
│   ├── rules/                        # 00-non-negotiables … 90-contracts
│   ├── skills/
│   │   ├── rsvp-master/              # coordinador (equivale a atlas-master)
│   │   ├── rsvp-discovery/           # discovery factual antes de editar
│   │   ├── rsvp-event-proof/         # evidencia de mensajería
│   │   ├── rsvp-contract-proof/      # evidencia OpenAPI/AsyncAPI/Pact
│   │   ├── rsvp-security-review/
│   │   ├── fable-*/                  # outcome-first, claim-ladder, prove-it, …
│   │   └── lane-01-… lane-33-…       # 33 carriles ejecutables
│   ├── agents/                       # rsvp-researcher, rsvp-qa-investigator
│   └── hooks/                        # progress.py, claim.py, stop_gate.py, resource_guard.py
├── tareas/                           # ← fichas de ESPECIFICACIÓN
│   ├── README.md                     # índice maestro, reparto, dependencias
│   └── TAREA-01-… TAREA-33-….md
├── docs/
│   ├── source-of-truth/backlog.json  # fuente funcional única
│   └── progress/
│       ├── STATUS_LOG.md · BLOCKERS.md · DECISIONS.md
│       └── evidence/lane-XX/
├── apps/
│   ├── identity-service/             # Spring Boot · Gradle · Java 21
│   ├── celebration-site-service/     # NestJS
│   ├── template-media-service/       # Django + DRF · Poetry
│   ├── guest-rsvp-service/           # NestJS
│   ├── gift-list-service/            # NestJS  ← carril de referencia
│   ├── provider-catalog-service/     # NestJS  ← núcleo de negocio
│   └── notification-service/         # NestJS
├── packages/
│   ├── contracts-openapi/            # 8 specs OpenAPI 3.1 (fuente de verdad)
│   ├── contracts-asyncapi/           # catálogo único de eventos
│   ├── contracts-types/              # tipos TS generados
│   ├── platform-outbox/              # outbox + relay + inbox idempotente
│   ├── platform-messaging/           # RabbitMQ: topología, retry, DLX
│   ├── platform-telemetry/           # OTel: traces, metrics, logs, correlation
│   ├── platform-auth/                # guard JWT/JWKS + TenantContext
│   ├── platform-testing/             # Testcontainers, fixtures, FakeDrivers
│   └── config-{eslint,ts,jest,prettier}/
├── infra/
│   ├── docker-compose.yml
│   ├── kong/kong.yml
│   ├── rabbitmq/definitions.json
│   ├── observability/                # otel-collector, prometheus, tempo, loki, grafana
│   └── postgres/init/                # 7 bases + roles + RLS
├── contracts/pacts/
├── .github/workflows/
├── turbo.json
└── package.json                      # Yarn 4 workspaces
```

**Java y Python en Turborepo**: cada app no-JS lleva un `package.json` mínimo cuyos scripts (`build`, `test`, `lint`, `docker:build`) delegan en Gradle o Poetry. Turbo los cachea y los incluye en `--affected`.

---

## 6. Plantilla hexagonal obligatoria

```
src/
├── domain/                     # CERO imports de @nestjs, prisma, amqplib, axios
│   ├── model/                  # agregados, entidades, value objects
│   ├── event/                  # eventos de dominio (clases puras)
│   ├── policy/                 # reglas de negocio puras
│   └── port/
│       ├── inbound/            # interfaces de casos de uso
│       └── outbound/           # repositorios, publishers, gateways
├── application/                # command handlers, query handlers, sagas
├── infrastructure/             # adaptadores salientes: prisma, rabbitmq, outbox, http
└── interface/                  # adaptadores entrantes: rest/, consumer/
```

**Test arquitectónico automatizado, parte del DoD de todo carril**: falla el build si algo bajo `domain/` importa framework. NestJS → test de imports; Spring → **ArchUnit**; Django → test que inspecciona el paquete `domain`.

**Notification Service** es el caso más estricto: un único `NotificationChannelPort` con adaptadores `Console`, `Mailhog`, `SES/Resend`, `WhatsAppBusiness`, `Twilio`, `ExpoPush`. El canal se resuelve por configuración, **nunca con un `if` en el dominio**.

---

## 7. Harness de carriles (adaptado de AloVida/ATLAS)

### 7.1 Dos unidades distintas

| | Unidad | Dónde | Para qué |
|---|---|---|---|
| **Especificación** | `tareas/TAREA-NN-*.md` | repo | Qué se pide, qué existe, el hueco real, criterios falsables, contrato de datos, riesgos, preguntas abiertas |
| **Ejecución** | `.claude/skills/lane-NN-*/` | repo | Cómo se ejecuta: SKILL.md + requirements + implementation-plan + test-plan + qa-checklist + fable-contract |

Igual que en AloVida: la ficha es *mucho más detallada* que el backlog e incluye lo que ya existe en el repositorio. Como aquí es greenfield, la sección "qué existe hoy" apunta a los `packages/platform-*` y al carril de referencia, no a código heredado.

### 7.2 Estructura de cada `lane-NN-*/`

```
lane-NN-<slug>/
├── SKILL.md               # frontmatter (name, description, allowed-tools, effort) + metadatos,
│                          # contrato de lectura, resultado esperado, progreso, regla de cierre
├── requirements.md        # REQ-NN-01 … con criterio falsable por cada uno
├── implementation-plan.md # slices verticales pequeños, en orden
├── test-plan.md           # casos Jest / Supertest / Pact / Testcontainers por REQ
├── qa-checklist.md        # el DoD de §9 instanciado para este carril
└── contract-impact.md     # qué endpoints OpenAPI y qué eventos AsyncAPI toca
```

### 7.3 Reglas no negociables (`.claude/rules/`)

Se heredan de AloVida y se adaptan: lo que allá era Playwright/visual, acá es **event-proof** y **contract-proof**.

| Archivo | Contenido clave |
|---|---|
| `00-non-negotiables.md` | No inventar rutas, contratos, entidades, columnas, estados ni fórmulas. Toda decisión respaldada por `SPEC` / `CODE` / `RUNTIME` / `TEST` / `EXTERNAL-DOC` / `UNKNOWN`. Una suposición jamás se vuelve implementación en silencio |
| `05-fable-lifecycle.md` | outcome-first · context-thrift · scope-discipline · root-cause-loop · prove-it · finish-your-turn. **Serializado**: un carril activo, máximo un subagente, nunca en background |
| `10-progress-protocol.md` | Máximo **3 operaciones materiales** sin checkpoint visible. `progress.py` al inicio y en cada transición de fase. Mantener `STATUS_LOG.md`, `BLOCKERS.md`, `DECISIONS.md` |
| `15-claim-ladder.md` | Escalera de estado: `NOT_STARTED → IN_PROGRESS → IMPLEMENTED → TESTED → REGRESSION_VERIFIED → DONE`. **`DONE` exige `REGRESSION_VERIFIED`.** Un REQ queda `PASS` o `BLOCKED-EXTERNAL` con evidencia; **`PARTIAL` no permite `DONE`** |
| `16-rationalization-guard.md` | Ante una excusa para saltarse un gate ("es trivial", "el test es flaky", "lo vemos después"), se bloquea el cierre |
| `20-resource-control.md` | Prohibido Agent Teams. Jest `--runInBand` para suites con Testcontainers. No levantar dos stacks de Docker Compose en paralelo |
| `30-testing.md` | Pirámide de §9. Prohibido debilitar aserciones válidas para que pase un test. Prohibido `skip`, TODO sustituyendo funcionalidad, o mock presentado como integración real |
| `40-security.md` | Autorización verificada **en backend**, no en el gateway solamente. Cero secretos/PII en logs y evidencias. Nunca migraciones destructivas para "hacer pasar" pruebas |
| `50-events.md` | Todo evento declarado en AsyncAPI **antes** de emitirse. Sobre estándar obligatorio. Emisión solo por outbox. Consumo siempre idempotente |
| `60-backend-hexagonal.md` | Estructura de §6. El dominio no conoce framework. Repositorios reciben `celebrationId` obligatorio |
| `70-data-seeders.md` | Seeds de geo Bolivia y categorías con fuente citada. Datos "reales" nunca generados y presentados como oficiales |
| `80-contracts.md` | OpenAPI/AsyncAPI son la verdad. Cambio de contrato = versión nueva + Pact republicado + aviso a los otros ejes |
| `90-tenancy.md` | Toda tabla con `celebration_id` lleva RLS. Todo endpoint tiene su test de fuga cross-tenant |

### 7.4 Hooks (`.claude/hooks/`)

- `progress.py --lane NN --phase <bootstrap|discovery|slice|qa|close> --state <active|blocked|done> --message "..."` → escribe `STATUS_LOG.md` y la evidencia del carril.
- `claim.py` → valida que el lenguaje de estado respete la Claim Ladder.
- `stop_gate.py` → impide cerrar con tests rojos, `skip`, cobertura bajo umbral o contratos sin publicar.
- `resource_guard.py` → impide suites pesadas en paralelo y Agent Teams.

### 7.5 Cómo se ejecuta un carril

1. Leer la ficha existente `docs/plan/carriles/lane-NN-*.md` **completa**, incluidos riesgos y preguntas abiertas.
2. Aplicar `$rsvp-backend-lane`, `$rsvp-evidence` y las skills adicionales según el alcance.
3. **Discovery factual antes de editar**: contratos existentes, migraciones, eventos ya declarados, qué hace el carril de referencia. Prohibido inventar.
4. Implementar por **slices verticales pequeños**; tras cada slice: typecheck + lint + tests dirigidos.
5. Si un test dirigido falla y es del carril: diagnosticar, corregir y **volver a ejecutar el mismo test**. No debilitar la aserción.
6. QA dirigido → regresión relevante → seguridad/tenancy → contratos publicados.
7. Cerrar con evidencia en `docs/progress/evidence/lane-NN/`. Los criterios de aceptación de la ficha **son** los casos del test-plan.

---

## 8. Modelo de dominio

### 8.1 Celebration Site Service

```
Celebration (agregado raíz · TENANT ROOT)
├─ id, slug (único global), organizationId?, ownerUserId[]
├─ celebrationTypeId → EventTypeDefinition
├─ status: DRAFT | PUBLISHED | ARCHIVED
├─ defaultLocale, supportedLocales[], timeZone (IANA), currency (ISO-4217)
├─ eventDate (timestamptz), ceremony{}, reception{}, venues[]
├─ CelebrationSettings (value object):
│   ├─ giftReservationMode:  AUTO_ACCEPT | RESTRICTED   ← prioridad 1
│   ├─ unregisteredRsvpMode: AUTO_ACCEPT | RESTRICTED
│   ├─ extraCompanionMode:   AUTO_ACCEPT | RESTRICTED
│   ├─ externalGiftMode:     AUTO_ACCEPT | RESTRICTED
│   ├─ rsvpDeadline (timestamptz), rsvpEditableUntilDeadline
│   └─ partnerPriorityEnabled
├─ sections[]   (historia, itinerario, dress code, FAQ, galería)
└─ version      (lock optimista)

EventTypeDefinition  (configuración, NO código)
├─ code: WEDDING | QUINCEANERA | BAPTISM | ANNIVERSARY | BIRTHDAY | CORPORATE | CUSTOM
├─ hostRoles[]                 WEDDING→[BRIDE,GROOM] · QUINCEANERA→[CELEBRANT]
├─ enabledSections[]
├─ requiredFieldsForPublish[]  ← resuelve el Hotspot #3
├─ compatibleTemplateTags[]
└─ i18n → event_type_translations(locale, key, value)
```

**Invariantes**: `DRAFT→PUBLISHED` solo con todos los `requiredFieldsForPublish` válidos · cambiar template **nunca** borra contenido · solo templates `PUBLISHED` y con tag compatible · `slug` inmutable tras publicar.

**Eventos**: `CelebrationCreated.v1`, `CelebrationTypeAssigned.v1`, `CelebrationConfigured.v1`, `CelebrationSettingsUpdated.v1`, `CelebrationPublished.v1`, `CelebrationArchived.v1`, `TemplateSelected.v1`.

### 8.2 Guest / RSVP Service

```
Guest       id, celebrationId, groupId?, fullName, email?, phone?, locale?,
            accessToken (hash, único), tokenStatus: ACTIVE|REVOKED|EXPIRED,
            allowedCompanions, consentGivenAt, erasedAt?
GuestGroup  familia / mesa; un token por miembro, agrupados para logística
Rsvp        id, celebrationId, guestId (1:1), status: PENDING|CONFIRMED|DECLINED,
            requestedCompanions, approvedCompanions, dietaryNotes, message,
            respondedAt, lastModifiedAt, revision
```

**Invariantes**: `requestedCompanions ≤ allowedCompanions` salvo `extraCompanionMode=AUTO_ACCEPT`; si `RESTRICTED` y excede → `CompanionRequest(PENDING_REVIEW)` y el RSVP queda CONFIRMED con los permitidos · modificar tras `rsvpDeadline` → `409 RsvpWindowClosed` · token revocado → `401` · rate limit por token y por IP en Kong.

**Eventos**: `GuestRegistered.v1`, `GuestGroupCreated.v1`, `GuestAccessTokenIssued.v1`, `GuestAccessTokenRevoked.v1`, `RsvpConfirmed.v1`, `RsvpDeclined.v1`, `RsvpChanged.v1`, `CompanionRequestRaised.v1`, `CompanionRequestResolved.v1`, `GuestErasureRequested.v1`, `GuestErased.v1`.

**Read models**: `read_guest_summary`, `read_guest_list`.

### 8.3 Gift List Service

```
GiftItem    id, celebrationId, source: CATALOGED|EXTERNAL,
            providerProductId? | externalUrl?, title, description,
            price: Money{amountMinor, currency}, imageUrl,
            status: AVAILABLE|PENDING_REVIEW|COMMITTED|REJECTED|PROPOSED,
            version  ← lock optimista
GiftReservation  id, giftItemId, celebrationId, guestId, guestDisplayName, message,
            status: PENDING_REVIEW|COMMITTED|REJECTED|CANCELLED,
            requestedAt, resolvedAt, resolvedByUserId?
```

```
                      giftReservationMode = AUTO_ACCEPT
           ┌─────────────────────────────────────────────┐
           │                                             ▼
AVAILABLE ─┤                                        COMMITTED
           │  RESTRICTED                                 ▲
           └─► PENDING_REVIEW ──[anfitrión confirma]─────┘
                      │
                      └──[anfitrión rechaza]──► REJECTED ──► AVAILABLE
```

**Invariante crítica**: la transición `AVAILABLE → PENDING_REVIEW|COMMITTED` usa `UPDATE … WHERE id=? AND version=?`; 0 filas afectadas → `409 GiftNotAvailable`. `COMMITTED` **solo** tras aprobación del anfitrión, o directo si `giftReservationMode=AUTO_ACCEPT` **en el instante de la solicitud**. Cambiar el modo no altera reservas ya resueltas ni drena las pendientes (D10). `source=EXTERNAL` con `externalGiftMode=RESTRICTED` → nace `PROPOSED`.

**Eventos**: `GiftListCreated.v1`, `GiftItemAdded.v1`, `ExternalGiftProposed.v1`, `ExternalGiftApproved.v1`, `GiftReservationRequested.v1`, `GiftReservationAutoCommitted.v1`, `GiftReservationConfirmed.v1`, `GiftReservationRejected.v1`, `GiftItemReleased.v1`.

### 8.4 Provider Catalog Service — núcleo del negocio

```
Provider         id, ownerUserId, legalName, displayName,
                 status: DRAFT|PENDING_VERIFICATION|VERIFIED|SUSPENDED,
                 country (default BO), state, city, geo{lat,lng},
                 currency (default BOB), locales[],
                 plan: FREE|FEATURED|PREMIUM, verifiedAt, verifiedByUserId

ServiceListing   providerId, categoryId, title/description (i18n), media[],
                 priceRange: Money..Money, serviceAreas[],
                 DESTINOS (≥1 obligatorio): officialUrl, landingUrl?, whatsappNumber?,
                 phone?, email?, instagramUrl?  + utm{source,medium,campaign} por destino

ProductListing   providerId, sku, title, price: Money, stockHint,
                 officialProductUrl (obligatorio)

Lead             id, providerId, listingId, listingType,
                 celebrationId?, guestId?, sessionId, correlationId,
                 destinationType: OFFICIAL_SITE|LANDING|WHATSAPP|PHONE|EMAIL|INSTAGRAM|PRODUCT_PAGE,
                 resolvedUrl, surface: PUBLIC_SITE|DASHBOARD|GIFT_CATALOG|SEARCH,
                 categoryId, geoContext, locale, device, referrer,
                 status: GENERATED|REDIRECTED|CONVERTED|INVALID, occurredAt

leadConfig       enabledDestinations[], utmTemplate, dedupeWindowMinutes,
                 monthlyLeadCap?, billingModel: CPC|CPL|FLAT|REVSHARE
```

**Mecánica de redirección** (lo que hace facturable el negocio):
1. El frontend enlaza a `GET /r/{listingId}?destination=…&celebrationId=…`, **nunca** al partner directo.
2. Se persiste el `Lead`, se resuelve la URL con UTM + `correlationId`, se responde **`302`** — *no 301*: el 301 lo cachea el navegador y se pierden los leads siguientes.
3. `ProviderLeadGenerated.v1` sale por outbox → alimenta `read_provider_metrics`.
4. Dedupe `(sessionId, listingId, destinationType)` dentro de `dedupeWindowMinutes` → `INVALID(dup)`. UA de bot → `INVALID(bot)`. No cuentan como facturables.
5. Alcanzado `monthlyLeadCap`, el listing **baja de ranking pero no se oculta**.

**Ranking** (`computeListingScore`, función pura con tabla de casos):
```
score = w1·verified + w2·planWeight + w3·geoMatch(ciudad>depto>país)
      + w4·categoryMatch + w5·completeness + w6·recencyCTR − w7·capExhausted
```
Regla dura: producto catalogado **siempre** por encima de regalo externo.

**Eventos**: `ProviderRegistered.v1`, `ProviderVerified.v1`, `ProviderSuspended.v1`, `ServiceListingPublished.v1`, `ProductCataloged.v1`, `ProviderLeadGenerated.v1`, `ProviderRedirectPerformed.v1`, `LeadMarkedInvalid.v1`, `ProviderLeadCapReached.v1`.

**Read models**: `read_provider_search`, `read_provider_metrics`.

### 8.5 Identity Service (Spring Boot / Java 21)

`User`, `Role` (`ADMIN|HOST|PLANNER|PROVIDER`), `Organization`, `OrganizationMember`. JWT **RS256** (access 15 min) + refresh opaco 30 d en Redis con rotación y detección de reuso. Expone `GET /.well-known/jwks.json`. Claims: `sub`, `roles[]`, `orgId?`, `celebrationIds[]`.
**Eventos**: `UserRegistered.v1`, `UserRoleGranted.v1`, `OrganizationCreated.v1`, `OrganizationMemberAdded.v1`.

### 8.6 Template / Media Service (Django + DRF)

`Template` (status, tags por tipo de evento, preview, estructura de secciones), `MediaAsset`, `MediaVariant`. Subida a **MinIO** (dev) / **S3 o R2** (prod) por URL pre-firmada; validación MIME y tamaño; variantes thumb/medium/full/webp. Las imágenes son **referencias**, nunca parte del agregado `Celebration`.
**Eventos**: `TemplatePublished.v1`, `TemplateArchived.v1`, `MediaUploaded.v1`, `MediaVariantsGenerated.v1`, `MediaDeleted.v1`.

### 8.7 Notification Service

Consume `RsvpConfirmed`, `RsvpDeclined`, `GiftReservationRequested`, `GiftReservationConfirmed`, `GiftReservationRejected`, `CompanionRequestRaised`, `ProviderLeadCapReached`, `CelebrationPublished`.
Dominio: `NotificationRequest`, `NotificationTemplate` (i18n), `DeliveryAttempt`, `DeviceToken` (Expo, por usuario y plataforma).
**Push iOS/Android obligatorio** vía Expo Push API: registro/baja de tokens, batching ≤100, manejo de `DeviceNotRegistered`. Preferencias por usuario y canal; quiet hours **en la timezone de la celebración**.
**Eventos**: `NotificationQueued.v1`, `NotificationSent.v1`, `NotificationFailed.v1`, `DeviceTokenRegistered.v1`.

---

## 9. Infraestructura event-driven

### 9.1 Sobre de evento (idéntico en los 7, definido en AsyncAPI)

```json
{
  "eventId": "uuid-v7",
  "eventType": "gift.reservation.requested",
  "eventVersion": 1,
  "occurredAt": "2026-10-09T14:32:00Z",
  "producer": "gift-list-service",
  "correlationId": "uuid",
  "causationId": "uuid",
  "tenant": { "celebrationId": "uuid", "organizationId": null },
  "actor": { "type": "GUEST", "id": "uuid" },
  "payload": {}
}
```

### 9.2 Outbox + relay + inbox

`outbox_event(id, aggregate_type, aggregate_id, event_type, event_version, payload jsonb, headers jsonb, status, attempts, available_at, created_at, published_at)`. El handler escribe agregado **y** outbox en la **misma transacción**. El relay (cada 500 ms) toma lotes con `FOR UPDATE SKIP LOCKED`, publica con confirms, marca `PUBLISHED`; backoff exponencial, `FAILED` + alerta tras N intentos.
Consumo idempotente: `inbox_event(event_id PK, consumer, processed_at)`; evento ya visto se ACKea sin reprocesar.

### 9.3 Topología RabbitMQ (`infra/rabbitmq/definitions.json`)

Exchanges topic: `identity.events`, `celebration.events`, `guest.events`, `gift.events`, `provider.events`, `template.events`, `notification.events`.
Routing key `<contexto>.<entidad>.<hecho>.v<N>` → `gift.reservation.requested.v1`.
Cola por (servicio consumidor, patrón): `notification-service.gift.reservation.*.v1`.
Retry con `x-dead-letter-exchange` → `<ctx>.retry` con TTL escalonado (5 s, 30 s, 2 m, 10 m) → reinyección. Tras 4 fallos → `<ctx>.parking` + alerta en Grafana + runbook de reproceso. `prefetch=10`, ACK manual siempre.

### 9.4 Observabilidad

**OpenTelemetry** en los tres runtimes → Collector → Prometheus / Tempo / Loki → Grafana.
`correlationId` nace en Kong, viaja en header, se copia al sobre del evento y se propaga al consumidor: **una traza única cubre HTTP → outbox → broker → consumidor → notificación**.
Logs JSON con PII redactada por capa de serialización (obligatorio GDPR).
Dashboards mínimos: p95 por endpoint, lag del outbox, profundidad de parking, error rate por consumidor, **leads/día por partner**.

### 9.5 Seguridad y multi-tenant

Kong: JWT, rate-limiting (agresivo en rutas públicas de RSVP y en `/r/*`), CORS, request-size-limiting, bot-detection.
`TenantContextGuard` extrae `celebrationId` del path/token y lo inyecta en `AsyncLocalStorage`; **todo repositorio lo recibe obligatoriamente**.
**PostgreSQL Row-Level Security** en toda tabla con `celebration_id`, como segunda red.
Secretos: `.env` en dev, Vault/secret manager en prod. Cero secretos en el repo (gitleaks en CI).

### 9.6 i18n, timezone, moneda, GDPR

Traducciones en `<entidad>_translations(entity_id, locale, field, value)` con fallback al `defaultLocale`. `Accept-Language` propagado desde Kong; el locale del invitado se persiste en `Guest` y manda en las notificaciones.
**Todo timestamp es `timestamptz` en UTC**; deadlines, itinerario y quiet hours se evalúan en la `timeZone` IANA de la celebración. Tests con `America/La_Paz` y `Europe/Madrid`, cruce de medianoche y DST.
`Money` = entero en unidades menores + ISO-4217; **BOB por defecto**. Sin pagos.
GDPR: consentimiento con timestamp; `GuestErasureRequested.v1` dispara anonimización en cascada en Guest, Gift y Notification; retención configurable; PII cifrada en reposo.

---

## 10. Los 33 carriles

### Semana 0 — "Contract Freeze" (los 4 juntos, 3-4 días, **único momento bloqueante**)

1. `packages/contracts-asyncapi` — catálogo completo de eventos con payloads y ejemplos.
2. `packages/contracts-openapi` — 8 specs con endpoints, errores y códigos.
3. ERD por servicio + matriz de permisos por rol.
4. `docker-compose up` levanta toda la infra (Postgres×7, RabbitMQ, Redis, MinIO, Kong, stack OTel).
5. Plantilla hexagonal de referencia + `packages/platform-*` con sus tests.
6. **El harness `.claude/` completo** (§7) y las 33 fichas `tareas/TAREA-NN-*.md`.

Desde aquí **nadie espera a nadie**: cada carril consume Pact stubs de los demás.

---

### 🟦 Eje A — **Pablo** · Plataforma + Identity (9 carriles)

| Lane | Nombre | Criterio de cierre |
|---|---|---|
| 01 | `monorepo-y-toolchain` | `yarn turbo run build lint test` verde en los 8 workspaces, incluidos Java y Python |
| 02 | `infra-local-docker-compose` | Un comando levanta todo; healthchecks verdes; runbook de arranque |
| 03 | `platform-messaging-rabbitmq` | Topología declarativa, publisher con confirms, consumer base con retry/DLX. Testcontainers RabbitMQ |
| 04 | `platform-outbox-inbox` | **Test: matar el proceso entre commit y publish → el evento sale igual al reiniciar.** Inbox idempotente probado |
| 05 | `platform-auth-tenant-context` | Guard JWT/JWKS + `TenantContext` en `AsyncLocalStorage`. Test de fuga cross-tenant |
| 06 | `platform-telemetry` | Traza única extremo a extremo verificable en Tempo; logs sin PII |
| 07 | `identity-service` | Dominio + JWT RS256 + JWKS + organizaciones y roles. JUnit 5 + Testcontainers + ArchUnit. Rotación de refresh con detección de reuso |
| 08 | `api-gateway-kong` | `kong.yml` versionado con rutas de los 8, JWT, rate-limit, CORS, correlation-id. E2E: request sin token → 401 **en el gateway** |
| 09 | `ci-cd-y-pact-broker` | `turbo --affected`, matriz de 3 runtimes, Pact broker, gitleaks, RLS aplicada, build+push de 7 imágenes |

### 🟩 Eje B — **Leo** · Celebration Site + Template/Media (7 carriles)

| Lane | Nombre | Criterio de cierre |
|---|---|---|
| 10 | `celebration-dominio-y-tenancy` | Dominio puro sin framework (test arquitectónico verde). CRUD con Supertest. 404 cross-tenant en todos los endpoints |
| 11 | `event-type-definition-multievento` | Seeds WEDDING y QUINCEANERA. **Test: añadir BAUTIZO solo con un seed, sin tocar código, y publicar una celebración de ese tipo** |
| 12 | `celebration-settings-auto-restricted` | Los 4 switches persistidos; `CelebrationSettingsUpdated.v1` por outbox; **test de no-retroactividad** |
| 13 | `publicacion-y-validacion` | `requiredFieldsForPublish` dirigido por datos. Falta un campo → 422 con la lista exacta de faltantes |
| 14 | `i18n-timezone-moneda` | Fallback de locale probado; tests con La Paz y Madrid cruzando medianoche y DST; `Money` con BOB |
| 15 | `read-model-sitio-publico` | Proyección por evento + **test de replay**: borrar la proyección, reconstruirla, comparar |
| 16 | `template-media-django` | Modelos + DRF + uploads a MinIO con URL pre-firmada + variantes + outbox Django con el mismo sobre. pytest + Testcontainers + Pact verificado. **Test: cambiar template no pierde contenido** |

### 🟨 Eje C — **Miguel** · Guest/RSVP + Notification (8 carriles)

| Lane | Nombre | Criterio de cierre |
|---|---|---|
| 17 | `guest-y-grupos` | Dominio puro; alta individual y masiva por CSV con reporte de errores por fila |
| 18 | `tokens-de-acceso-invitado` | Token opaco, hash en DB, revocable. Revocado→401, inexistente→401, de otra celebración→404. Rate limit verificado |
| 19 | `rsvp-confirmacion-y-edicion` | 3 transiciones + evento en outbox. **Test con reloj fijo: antes del deadline→200, después→409 `RsvpWindowClosed`** |
| 20 | `acompanantes-y-no-registrados` | `requested>allowed` con AUTO→aprueba, con RESTRICTED→`CompanionRequestRaised` + aprobación parcial. No registrado: AUTO→crea y confirma, RESTRICTED→403 |
| 21 | `read-models-invitados` | `read_guest_summary` y `read_guest_list`; test de replay y de consistencia eventual |
| 22 | `gdpr-derecho-al-olvido` | `GuestErasureRequested` anonimiza en cascada; verificación de que no queda PII en logs ni evidencias |
| 23 | `notification-hexagonal-canales` | `NotificationChannelPort` + adaptadores Email/WhatsApp/SMS conmutables por env. **Test arquitectónico: el dominio no conoce ningún SDK.** Plantillas i18n + quiet hours en tz de la celebración. **Test: mismo evento 3 veces → 1 sola notificación** |
| 24 | `push-ios-android-expo` | Registro/baja de device tokens, batching ≤100, manejo de `DeviceNotRegistered`. FakeDriver determinista en tests + **evidencia de envío real en un dispositivo iOS y uno Android** |

### 🟥 Eje D — **Fabio** · Gift List + Provider Catalog · **el negocio** (9 carriles)

| Lane | Nombre | Criterio de cierre |
|---|---|---|
| 25 | `gift-list-dominio` | Máquina de estados completa en tests unitarios puros |
| 26 | `reserva-concurrencia-y-aprobacion` | **20 peticiones concurrentes reales sobre el mismo regalo: exactamente 1→201, 19→409. Repetido 10 veces sin flake.** Rechazo devuelve a AVAILABLE; solo el anfitrión resuelve (403 para otros) |
| 27 | `modo-auto-accept-regalos` | AUTO→`COMMITTED` + `GiftReservationAutoCommitted`; RESTRICTED→`PENDING_REVIEW` + notificación. **Test: con 3 pendientes, cambiar a AUTO_ACCEPT → siguen PENDING_REVIEW** |
| 28 | `regalos-catalogados-vs-externos` | `externalGiftMode=RESTRICTED`→nace `PROPOSED`; prioridad de catalogados verificada en el orden de la respuesta |
| 29 | `provider-onboarding-y-verificacion` | `DRAFT→PENDING_VERIFICATION→VERIFIED`; solo `VERIFIED` aparece en búsqueda; rol `PROVIDER` en Identity |
| 30 | `listings-geo-bolivia-categorias` | **Invariante: ≥1 destino de redirección obligatorio o 422.** Departamentos y ciudades de Bolivia sembrados con fuente citada; filtro y orden por cercanía probado con 3 ciudades; categorías i18n |
| 31 | `motor-de-redireccion-y-leads` | **302 (nunca 301)**, UTM + `correlationId` en la URL final, `Lead` persistido, `ProviderLeadGenerated` en outbox. Test que asierta la URL resuelta |
| 32 | `lead-config-dedupe-y-ranking` | Dedupe por ventana → `INVALID(dup)`; UA de bot → `INVALID(bot)`; alcanzado el cap **baja de ranking pero no se oculta**; `computeListingScore` con tabla de casos (verificado > no; ciudad > depto > país; PREMIUM pondera; cap penaliza) |
| 33 | `read-model-metricas-partner` | Impresiones, clics, CTR y leads válidos por día/categoría/destino. **Test de replay reconstruye cifras idénticas.** Integración Gift↔Provider verificada por Pact |

### Dependencias entre ejes (todas por contrato, ninguna bloqueante)

```
Semana 0 · Contract Freeze (los 4)
   ├── A (Pablo)  → entrega platform-* y Kong en semana 1; el resto trabaja con stubs
   ├── B (Leo)    → publica CelebrationSettings y CelebrationPublished (los consumen C y D)
   ├── C (Miguel) → consume settings de B; notifica eventos de C y D
   └── D (Fabio)  → consume settings de B; emite a C
```

Dependencias internas que **sí** ordenan el trabajo (igual que la tabla de predecesores de AloVida):
`04→03` · `05→07` · `08→07` · `11→10` · `12→10` · `13→11` · `15→13` · `16→11` · `18→17` · `19→18` · `20→19` · `21→19` · `24→23` · `26→25` · `27→26` · `28→25,30` · `30→29` · `31→30` · `32→31` · `33→32`.

> ⚠️ **Dos dependencias cruzan de persona**: `28` (Fabio) necesita `30` (Fabio, mismo eje, arrancar antes) y **`12` de Leo es predecesora de `20` de Miguel y de `27` de Fabio**. El carril 12 debe arrancar primero en el eje B.

Si un productor se retrasa, el consumidor sigue contra su **Pact stub**. El contrato es la verdad; el servicio es un detalle de implementación.

---

## 11. Estrategia de pruebas y Definition of Done

### Pirámide

| Nivel | NestJS (5) | Spring (1) | Django (1) |
|---|---|---|---|
| Unitario de dominio | **Jest**, sin mocks de framework | JUnit 5 + AssertJ | pytest |
| Arquitectura | test de imports prohibidos | **ArchUnit** | test de imports |
| Integración (DB real) | Jest + **Testcontainers Postgres** | Testcontainers | pytest-django + Testcontainers |
| API de servicio | **Supertest** contra la app Nest completa | MockMvc / RestAssured | DRF `APIClient` |
| Mensajería | Testcontainers RabbitMQ: publicar→consumir→asertar proyección | ídem | ídem |
| Contrato | **Pact** consumidor + verificación del proveedor en CI | Pact-JVM | pact-python |
| E2E de flujo | Suite TS con Supertest contra el `docker-compose` completo, **entrando por Kong** | — | — |

### Flujos E2E obligatorios

1. **Alta y publicación**: admin publica template → anfitrión crea celebración QUINCEAÑOS → configura → publica → el sitio público responde.
2. **RSVP completo**: registrar invitado → emitir token → confirmar por magic link → `read_guest_summary` actualizado → push + email enviados.
3. **Regalo RESTRICTED**: solicita → `PENDING_REVIEW` → anfitrión confirma → `COMMITTED` → notificación al invitado.
4. **Regalo AUTO_ACCEPT**: solicita → `COMMITTED` directo, sin bandeja.
5. **Carrera de reserva**: 20 concurrentes, 1 gana.
6. **Lead de partner**: ver ficha → clic a WhatsApp → 302 con UTM → `Lead` persistido → `read_provider_metrics` incrementado.
7. **Multi-tenant**: celebración A no accede a nada de B (404 en los 7 servicios).
8. **Resiliencia**: tirar RabbitMQ, ejecutar comandos, levantarlo → los eventos retenidos en outbox se publican solos.

### Definition of Done — se aplica a **cada** carril, sin excepción

- [ ] Todos los REQ en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. **`PARTIAL` no permite `DONE`.**
- [ ] Dominio sin dependencias de framework; test arquitectónico verde.
- [ ] Tests unitarios de todas las invariantes del carril.
- [ ] Tests de integración con **DB real** (Testcontainers), nunca contra la DB de desarrollo.
- [ ] Tests de API cubriendo camino feliz **y todos** los códigos de error documentados.
- [ ] **Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.** El build falla por debajo.
- [ ] Cero flakes: la suite del carril corre 3 veces seguidas en CI sin fallar.
- [ ] Si emite eventos: fila de outbox verificada en test + evento declarado en AsyncAPI **antes** de emitirse.
- [ ] Si consume eventos: **test de idempotencia** (mismo evento 3 veces = 1 efecto).
- [ ] Si toca datos de tenant: **test de fuga cross-tenant** (404/403) + RLS activa.
- [ ] OpenAPI actualizado, Pact del consumidor publicado y verificado por el proveedor.
- [ ] Trazas OTel con `correlationId` propagado; logs sin PII ni secretos.
- [ ] Migración versionada y reversible (Prisma Migrate / Flyway / Django migrations).
- [ ] Variables de entorno documentadas en `.env.example`.
- [ ] `docker build` del servicio pasa y el healthcheck responde.
- [ ] Evidencia en `docs/progress/evidence/lane-NN/`; `STATUS_LOG.md`, `DECISIONS.md` y `BLOCKERS.md` al día.
- [ ] Revisión de código por otro eje (rotativa) aprobada.
- [ ] Estado final declarado con la Claim Ladder: `REGRESSION_VERIFIED` antes de `DONE`.

---

## 12. Archivos y artefactos de referencia

Todo es nuevo. Los puntos que el resto copia:

- `RSVPBackend/turbo.json` + `package.json` — Pablo, día 1.
- `RSVPBackend/.claude/` completo + `tareas/README.md` — el harness, semana 0.
- `RSVPBackend/infra/docker-compose.yml`, `infra/kong/kong.yml`, `infra/rabbitmq/definitions.json`.
- `RSVPBackend/packages/contracts-asyncapi/asyncapi.yaml` — **catálogo único de eventos, fuente de verdad**.
- `RSVPBackend/packages/platform-outbox/src/` — se reutiliza tal cual en los 5 NestJS; se reimplementa en Spring y Django **respetando el mismo contrato de sobre**.
- `RSVPBackend/apps/gift-list-service/` — **carril de referencia**: tiene la máquina de estados más rica, la concurrencia y el modo AUTO/RESTRICTED. Los demás copian su estructura hexagonal literalmente.
- `RSVPBackend/apps/provider-catalog-service/src/domain/model/lead.ts` y `.../policy/compute-listing-score.ts` — el núcleo del modelo de negocio.

---

## 13. Verificación extremo a extremo

```bash
cd RSVPBackend

# 1. Infra completa
docker compose up -d && docker compose ps          # todos healthy

# 2. Build y tests de todo el monorepo (3 runtimes)
yarn install && yarn turbo run build lint test

# 3. Migraciones y seeds (tipos de evento, geo Bolivia, categorías)
yarn turbo run db:migrate db:seed

# 4. Contratos
yarn pact:publish && yarn turbo run pact:verify

# 5. E2E contra el stack real, entrando por Kong
yarn test:e2e                                      # los 8 flujos de §11

# 6. Comprobaciones manuales
#  · Grafana  localhost:3000   → traza única RSVP → notificación
#  · RabbitMQ localhost:15672  → parking queues vacías
#  · Mailhog  localhost:8025   → emails renderizados en es-BO y en-US
#  · curl -I "localhost:8000/r/{listingId}?destination=WHATSAPP"  → 302 con UTM
#  · Push real en un dispositivo iOS y uno Android (evidencia en el PR)
```

---

## 14. Fuera de alcance de esta entrega

Frontend (web, dashboard, admin, mobile), procesamiento de pagos y compras reales, facturación efectiva de los leads (se **mide** todo lo necesario, no se cobra), despliegue a producción e IaC de nube, y Event Sourcing.

---

## 15. Preguntas abiertas declaradas

Siguiendo la disciplina de AloVida, lo que no se puede resolver sin el propietario **no se inventa**:

- **P-01 · Modelo de facturación por defecto de los partners.** Están los cuatro modelos (`CPC`/`CPL`/`FLAT`/`REVSHARE`) en `leadConfig`, pero cuál aplica por defecto y con qué tarifa es decisión comercial, no técnica. El backend lo mide todo igual.
- **P-02 · Visibilidad del solicitante de un regalo.** El Event Storming lo lista como hotspot. Queda configurable por celebración, con default `oculto hasta confirmar`.
- **P-03 · Proveedor real de WhatsApp Business.** Meta Cloud API vs. BSP local. El puerto hexagonal es el mismo; cambia solo el adaptador.
- **P-04 · Retención de datos y residencia.** La estructura GDPR está, pero el plazo concreto y si hay exigencia de residencia en la UE depende del contrato con el cliente internacional.

---

## 16. Enmienda al backend: agenda del proveedor (3 carriles nuevos)

El mini-marketplace con máximo alcance (Parte II) exige disponibilidad y reserva de fecha, que el plan original no contemplaba. Se añaden al **eje de Fabio**, dentro de Provider Catalog:

```
ProviderAvailability (agregado)
├─ providerId, timeZone (IANA)
├─ rules[]      recurrentes: lunes a sábado, 08:00–20:00
├─ blackouts[]  bloqueos puntuales y rangos
└─ capacityPerDay   cuántos eventos puede tomar por día

BookingRequest (agregado)
├─ id, providerId, listingId?, celebrationId?, requesterContact
├─ requestedDate, guestCountHint, budgetHint, message
├─ status: REQUESTED | CONFIRMED | REJECTED | CANCELLED | EXPIRED
└─ version (lock optimista)

QuoteRequest (agregado)   ← carrito de intención / formulario de cotización
├─ id, providerId, items[]{listingId, sku, qty, note}
├─ eventDate, guestCount, budget, contact, message
└─ status: SENT | ANSWERED | CLOSED
```

**Invariante de concurrencia** (misma mecánica que la reserva de regalos): tomar el último cupo de un día usa lock optimista; el segundo solicitante recibe `409 SlotNotAvailable`. Una fecha dentro de un `blackout` o fuera de las `rules` → `422`.

**Fulfillment declarativo** (logística post-venta, responsabilidad del partner o del cliente, nunca de la plataforma): cada `ServiceListing` y `ProductListing` lleva
`fulfillment{ responsibleParty: PARTNER|CLIENT, coverageAreas[], travelFee: Money?, leadTimeDays, conditions (i18n), disclaimerAccepted }`. Es **obligatorio** para publicar un listing (`422` si falta) y se muestra siempre antes del botón de contacto, con el deslinde explícito de la plataforma.

| Lane | Nombre | Criterio de cierre |
|---|---|---|
| 34 | `provider-availability` | Reglas recurrentes + blackouts + capacidad; cálculo de días disponibles probado con tz distintas de la del servidor |
| 35 | `booking-request-concurrencia` | **20 solicitudes concurrentes al último cupo: 1→201, 19→409.** Confirmar/rechazar solo el partner (403 para otros); expiración por TTL |
| 36 | `quote-request-y-fulfillment` | Cotización con items y contexto del evento → `QuoteRequested.v1` → notificación al partner. **`fulfillment` obligatorio o 422**; filtrable por zona de cobertura |

**Eventos nuevos**: `ProviderAvailabilityUpdated.v1`, `BookingRequested.v1`, `BookingConfirmed.v1`, `BookingRejected.v1`, `BookingExpired.v1`, `QuoteRequested.v1`, `QuoteAnswered.v1`.
**Read model nuevo**: `read_provider_calendar` (días disponibles por partner y mes, proyectado por evento).

Con esto el backend pasa de 33 a **36 carriles**; el eje de Fabio queda con 12.

# Plan de ejecución · RSVP Backend

Plataforma de Celebraciones · Monorepo poliglota · DDD + CQRS + Hexagonal · Event-Driven

---

## Cómo se lee esta carpeta

**Revisión vigente (16-oct-2026):** lee [la replanificación por slices verticales](revision-vertical-slice-2026-10-16.md) antes de ejecutar el calendario o una ficha. Sus cortes y gates de UX/animación/CodeGraph prevalecen sobre las listas históricas por componentes. Las fechas H1–H6 siguen como objetivos y requieren reestimación con evidencia de capacidad; no equivalen a compromiso verificado.

| Carpeta | Qué contiene | Cuándo la abrís |
|---|---|---|
| [`00-plan-maestro.md`](00-plan-maestro.md) | El plan completo: contexto, negocio, decisiones de arquitectura, modelo de dominio, infraestructura | Una vez al empezar. Es la referencia que no cambia |
| [`calendario/`](calendario/) | Una ficha por semana, del **12-oct-2026** al **15-ene-2027**, con qué hace cada persona día por día | Cada lunes |
| [`equipo/`](equipo/) | Una ficha por programador: su eje, sus carriles, su calendario personal | Cada mañana |
| [`carriles/`](carriles/) | Una orden de trabajo por carril: REQs falsables, slices, plan de pruebas y Definition of Done | Cuando arrancás un carril |

El frontend tiene su propia carpeta equivalente en `RSVPFrontend/docs/plan/`.

---

## El equipo y sus ejes

| Persona | Eje | Servicios que le pertenecen | Carriles backend | Carriles frontend | Total |
|---|---|---|---:|---:|---:|
| **Pablo** | Plataforma + Identity | API Gateway (Kong), Identity Service, `packages/platform-*`, CI/CD, observabilidad | 9 (01–09) | 7 (F01–F07) | 16 |
| **Leo** | Celebración + Contenido | Celebration Site Service, Template/Media Service | 7 (10–16) | 8 (F08–F14, F24) | 15 |
| **Miguel** | Invitados + Avisos | Guest/RSVP Service, Notification Service | 8 (17–24) | 8 (F15–F21, F23) | 16 |
| **Fabio** | **Negocio** | Gift List Service, Provider Catalog Service | 12 (25–36) | 5 (F22, F25–F28) | 17 |

**Propiedad vertical**: cada quien es dueño de su dominio de punta a punta — dominio, persistencia, HTTP, outbox, consumidores, tests, Dockerfile y CI. Nadie toca el servicio de otro. La única forma de cruzarse es por **contrato**: OpenAPI 3.1 y AsyncAPI, versionados en `packages/contracts-*`.

---

## Hitos

| Hito | Fecha | Qué tiene que ser verdad |
|---|---|---|
| **H1 · Contratos congelados** | vie 16-oct-2026 | Los 8 OpenAPI y el catálogo AsyncAPI firmados por los 4. `docker compose up` levanta toda la infra |
| **H2 · Primer evento extremo a extremo** | vie 30-oct-2026 | Un comando escribe en outbox, el relay publica, un consumidor lo procesa, la traza se ve en Tempo |
| **H3 · Núcleo de negocio funcional** | vie 20-nov-2026 | Celebración publicable, RSVP confirmable, regalo reservable con concurrencia probada |
| **H4 · Backend completo** | vie 11-dic-2026 | Los 36 carriles en `DONE`. Los 8 flujos E2E verdes entrando por Kong |
| **H5 · Producto navegable** | vie 01-ene-2027 | Sitio público, RSVP, dashboard y marketplace usables en web y móvil |
| **H6 · Entrega** | vie 15-ene-2027 | E2E web y móvil verdes, binarios iOS y Android firmados, documentación cerrada |

---

## Reglas que no se negocian

1. **Ninguna base de datos se comparte.** Integración solo por evento o API pública versionada.
2. **Ningún evento se publica sin pasar por el outbox**, dentro de la misma transacción del agregado.
3. **Ningún consumidor sin test de idempotencia**: el mismo evento tres veces produce un solo efecto.
4. **Ningún endpoint con datos de celebración sin test de fuga cross-tenant.**
5. **El dominio no conoce el framework.** Hay un test que falla si `domain/` importa NestJS, Prisma, amqplib o axios.
6. **`PARTIAL` no permite `DONE`.** Un requisito queda `PASS` o `BLOCKED-EXTERNAL` con evidencia concreta.
7. **No se inventa nada.** Toda decisión se respalda con `SPEC`, `CODE`, `RUNTIME`, `TEST` o `EXTERNAL-DOC`. Lo que no se sabe se marca `UNKNOWN` y se pregunta.

El detalle vive en [`00-plan-maestro.md`](00-plan-maestro.md) §7 y en el Definition of Done de cada carril.

---

## Arranque diario

```bash
cd RSVPBackend
docker compose up -d                 # infra local
yarn install
yarn turbo run build lint test       # todo verde antes de tocar nada
```

Y después, tu carril:

```
Usa $rsvp-backend-lane para ejecutar el carril NN completo
```

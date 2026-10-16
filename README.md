# RSVP Backend

Monorepo de los servicios backend, contratos y paquetes de plataforma de RSVP.

Para trabajar un carril, consulta [las instrucciones obligatorias](AGENTS.md), [las skills](.agents/skills/rsvp-backend-lane/SKILL.md) y [las convenciones de código](docs/engineering/convenciones.md).
Codex y Gemini CLI descubren las skills compartidas en `.agents/skills/`; Claude Code usa las entradas de `.claude/skills/`. `CLAUDE.md` y `GEMINI.md` importan el mismo `AGENTS.md`. La [política de skills](docs/engineering/skills.md) exige recarga en cada prompt y documenta las 50 skills de marketing y las nuevas skills de diseño.

La [replanificación vigente](docs/plan/revision-vertical-slice-2026-10-16.md) define el primer slice de los 36 carriles y los gates compartidos con frontend. CodeGraph está fijado en el proyecto: `corepack yarn graph:init` crea el índice local y `corepack yarn graph:status` comprueba su estado.

## Toolchain fijado

- Node `24.18.1` (`.nvmrc`) y Yarn `4.10.3` mediante Corepack.
- Java 21 para Identity.
- Python `3.14.0` (`.python-version`) para Template/Media.
- Docker Desktop con Compose v2 para la infraestructura local.

## Arranque local

```powershell
corepack enable
corepack yarn install --immutable
Copy-Item .env.example .env
docker compose up -d
corepack yarn infra:verify
corepack yarn check
```

El detalle de puertos, recuperación y limpieza está en [el runbook de arranque](docs/runbooks/arranque-local.md). Para detener la infraestructura sin borrar datos, ejecutá `docker compose down`.

## Validaciones de plataforma

```powershell
corepack yarn contracts:validate
corepack yarn workspace @rsvp/platform-messaging test
corepack yarn workspace @rsvp/platform-outbox test
```

La topología de producción es declarada por `@rsvp/platform-messaging`; `infra/rabbitmq/definitions.json` deja precargados los siete exchanges de eventos para desarrollo. El patrón de uso y reproceso está documentado en [outbox e inbox](docs/runbooks/outbox-inbox.md) y [parking](docs/runbooks/reprocesar-parking.md).

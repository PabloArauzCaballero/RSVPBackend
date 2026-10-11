# RSVP Backend

Monorepo de los servicios backend, contratos y paquetes de plataforma de RSVP.

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

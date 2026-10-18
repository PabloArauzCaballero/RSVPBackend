# Celebration Site Service

The root aggregate of the platform (lanes 10–15): a `Celebration` is any event with hosts, guests, gifts and providers, and it is the tenant every other service hangs from.

## Run

```bash
yarn workspace @rsvp/celebration-site-service build
yarn workspace @rsvp/celebration-site-service start      # in memory, no infrastructure needed
CELEBRATION_DATABASE_URL=postgresql://celebration_owner:local-celebration-password@localhost:5432/celebration_db \
CELEBRATION_AUTO_MIGRATE=true RABBITMQ_URL=amqp://local-rabbitmq:local-rabbitmq-password@localhost:5672 \
  yarn workspace @rsvp/celebration-site-service start    # Postgres + RabbitMQ
docker compose --profile apps up -d --build celebration-site-service   # behind Kong at :8000/celebrations
```

Operations: `yarn migrate` (`up` / `down N`), `yarn seed` (event types), `yarn replay` (rebuild the public read model).

## Tests

| Command | What |
|---|---|
| `yarn test` | Domain, HTTP (real server, real RS256 tokens), contracts (AsyncAPI, Gift List and Guest/RSVP consumers, Django envelope) and architecture |
| `yarn test:integration` | Real Postgres (RLS, concurrency, migrations up/down) and RabbitMQ, three runs in a row |
| `yarn coverage` | Fails under 80 % lines or functions |

## Layout

```
src/domain/          aggregate, value objects, policies, events, ports — no framework, no node:* imports
src/application/     commands and queries; one command = one transaction (aggregate + outbox + audit)
src/infrastructure/  memory and Postgres adapters, outbox relay, RabbitMQ, JWKS auth, public projection
src/interface/       HTTP routes (node:http + zod) and message consumers
db/migrations/       versioned, reversible SQL with forced RLS
db/seeds/            event types as data (adding one is a row, not a deploy)
```

API: [`packages/contracts-openapi/specs/celebration.openapi.json`](../../packages/contracts-openapi/specs/celebration.openapi.json). Events: `celebration.*` in [`asyncapi.yaml`](../../packages/contracts-asyncapi/asyncapi.yaml).

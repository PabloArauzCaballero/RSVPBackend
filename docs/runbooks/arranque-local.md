# Arranque local

## Requisitos

- Docker Desktop con Compose v2.
- Node 24.18.1 y Corepack activo.
- Java 21 y Python 3.14 para los servicios posteriores.

## Primer arranque

1. Copiá `.env.example` a `.env` y, si hace falta, reemplazá únicamente las credenciales locales.
2. Ejecutá `corepack enable && corepack prepare yarn@4.10.3 --activate`.
3. Ejecutá `corepack yarn install` y luego `docker compose up -d` desde la raíz.
4. Confirmá con `docker compose ps` que Postgres, RabbitMQ, Redis, MinIO y Kong estén saludables.

Interfaces locales: Kong `:8000`, RabbitMQ `:15672`, MinIO `:9001`, MailHog `:8025`, Prometheus `:9090` y Grafana `:3000`.

## Limpieza y recuperación

- Detener sin perder datos: `docker compose down`.
- Reiniciar solo la infraestructura: `docker compose up -d`.
- Borrar datos locales intencionalmente: `docker compose down -v`. Esto destruye las siete bases de desarrollo y los objetos locales.

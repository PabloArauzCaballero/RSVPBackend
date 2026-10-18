# Evidencia · Eje B (Leo) · carriles 10–16

Fecha de verificación: 2026-10-17. Sustituye la evidencia del 2026-10-11, que dejaba Postgres, MinIO y RabbitMQ sin verificar.

| Carril | Estado | Detalle |
|---|---|---|
| [10 · Dominio y tenancy](lane-10/README.md) | `REGRESSION_VERIFIED` (falta revisión de otro eje) | Dominio sin framework, RLS forzada, 404 cross-tenant en los 13 endpoints |
| [11 · Multi-evento](lane-11/README.md) | `REGRESSION_VERIFIED` (falta revisión) | BAUTIZO por seed en caliente, en memoria y en Postgres |
| [12 · AUTO/RESTRICTED](lane-12/README.md) | `REGRESSION_VERIFIED` (falta confirmación escrita de Miguel y Fabio) | No retroactividad probada contra el código real de Gift List y Guest/RSVP |
| [13 · Publicación](lane-13/README.md) | `REGRESSION_VERIFIED` (falta revisión) | 422 con la lista exacta, auditoría de despublicación |
| [14 · i18n, tiempo, dinero](lane-14/README.md) | `REGRESSION_VERIFIED` (falta revisión) | DST de Madrid, medianoche de La Paz, proceso hijo con `TZ=Europe/Madrid` |
| [15 · Read model público](lane-15/README.md) | `REGRESSION_VERIFIED` (falta revisión) | Replay byte a byte en memoria y en Postgres; una sola consulta |
| [16 · Django templates y media](lane-16/README.md) | `REGRESSION_VERIFIED` (falta revisión) | MinIO real, 4 variantes, sobre idéntico al de NestJS |

`DONE` exige además la revisión de código por otro eje y la publicación de Pacts en un broker, que está bloqueada (ver [BLOCKERS](../BLOCKERS.md)).

## Cómo reproducirlo

```bash
docker compose up -d postgres rabbitmq minio && docker compose up minio-init
yarn workspace @rsvp/celebration-site-service test               # 57 pruebas: dominio, HTTP, contratos, arquitectura
yarn workspace @rsvp/celebration-site-service test:integration   # Postgres + RabbitMQ reales, 3 corridas seguidas
yarn workspace @rsvp/celebration-site-service coverage            # umbral 80 % líneas y funciones
yarn workspace @rsvp/template-media-service setup                 # una vez: .venv con requirements.txt
yarn workspace @rsvp/template-media-service test                  # 32 pruebas (3 de infraestructura se saltan)
yarn workspace @rsvp/template-media-service test:integration      # Postgres con RLS como template_owner + MinIO real, 3 corridas
node e2e/gateway/leo-live.mjs                                     # despliegue en Docker y recorrido completo por Kong
```

## Registros

| Archivo | Resultado |
|---|---|
| [celebration-unit-http-contract.log](lanes-10-16-logs/celebration-unit-http-contract.log) | 57/57 |
| [celebration-postgres-rabbitmq-x3.log](lanes-10-16-logs/celebration-postgres-rabbitmq-x3.log) | 11/11 × 3 corridas |
| [celebration-coverage.log](lanes-10-16-logs/celebration-coverage.log) | 68/68 · 96,3 % líneas, 91,6 % ramas, 95,0 % funciones |
| [template-media-postgres-minio-x3.log](lanes-10-16-logs/template-media-postgres-minio-x3.log) | 32/32 × 3 corridas (RLS y MinIO incluidos) |
| [live-through-kong.log](lanes-10-16-logs/live-through-kong.log) | Recorrido completo por el gateway en contenedores |

Cobertura por capa del servicio Celebration: `domain/` 100 % de líneas en todo lo ejecutable (los archivos de solo tipos aparecen con líneas de declaración sin código), `application/` 100 % en comandos y consultas.

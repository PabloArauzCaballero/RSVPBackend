# Outbox e inbox

Cada servicio escribe su cambio de agregado y el `outbox_event` en **la misma transacción de PostgreSQL**. El request termina después del commit; no espera a RabbitMQ. `OutboxRelay` reclama lotes con `FOR UPDATE SKIP LOCKED`, publica con confirmación y solo entonces marca el evento como `PUBLISHED`.

Si un proceso cae tras reclamar un evento y antes de publicarlo, el lease vence y otro relay lo reclama de nuevo. Si RabbitMQ no está disponible, el evento vuelve a `PENDING` con backoff exponencial; después del máximo configurado queda `FAILED` para alerta y reparación, nunca se descarta.

La tabla `inbox_event` usa `event_id` como clave primaria. El consumidor debe ejecutar su efecto de negocio y la inserción de inbox en la misma transacción. Las adaptaciones en memoria sirven únicamente para pruebas; las tablas base están en `packages/platform-outbox/sql/001_outbox_inbox.sql`.

## Métrica de lag

Exponé `rsvp_outbox_oldest_pending_seconds` por contexto: la diferencia entre `NOW()` y el `created_at` más antiguo con estado `PENDING` o `PROCESSING`. Alertá cuando supere el SLO del servicio o exista algún evento `FAILED`.

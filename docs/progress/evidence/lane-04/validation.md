# Carril 04 · validación local

Validado localmente el 11 de octubre de 2026:

- `corepack yarn workspace @rsvp/platform-outbox test`: 6/6 pruebas en verde.
- El relay reclama con la consulta `FOR UPDATE SKIP LOCKED`, marca estados y aplica backoff.
- Se prueba la recuperación de un evento cuando un proceso muere después de reclamarlo: al vencer el lease, otro relay lo publica.
- Se prueba inbox idempotente para tres entregas y la liberación de un claim cuando el handler falla.
- `packages/platform-outbox/sql/001_outbox_inbox.sql` aporta las tablas e índices PostgreSQL requeridos; `PostgresOutboxRepository` mantiene la transacción de escritura y el claim en SQL.

La prueba de concurrencia y caída de proceso contra PostgreSQL/RabbitMQ reales queda pendiente del mismo bloqueo de Docker documentado; las pruebas unitarias no se presentan como sustituto de esa evidencia.

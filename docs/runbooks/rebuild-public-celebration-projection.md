# Reconstruir la proyeccion publica de una celebracion

1. Reproducir, en orden de `occurredAt`, los eventos de celebration-site-service del `celebrationId` afectado en `read_public_celebration`.
2. Verificar el payload reconstruido contra `GET /public/celebrations/{slug}` en cada locale soportado.
3. Si el agregado final no esta `PUBLISHED`, borrar la fila de proyeccion.

El consumidor es idempotente: reentregar un evento deja el mismo payload. En produccion el replay se ejecuta contra el outbox/RabbitMQ, no editando JSON a mano en PostgreSQL.

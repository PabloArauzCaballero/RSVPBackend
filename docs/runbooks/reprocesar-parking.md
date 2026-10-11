# Reproceso de mensajes en parking

1. Investigá primero el header `x-rsvp-reason`, el `eventId` y el `correlationId` en la cola `<contexto>.parking` de RabbitMQ.
2. Corregí la causa antes de reprocesar. Reenviar sin corregirla vuelve a estacionar el evento.
3. Publicá el cuerpo original en `<contexto>.events` con su routing key original (`<contexto>.<entidad>.<hecho>.v<N>`). Conservá `eventId`, `correlationId`, `tenant` y `traceparent`; quitá solamente `x-rsvp-attempt`.
4. Confirmá que el consumidor procesó el evento y que `inbox_event` contiene el `eventId`. El reproceso puede entregar un duplicado, pero la inbox garantiza un único efecto.

Para desarrollo, la publicación se puede hacer desde la interfaz de RabbitMQ (`localhost:15672`). En un entorno compartido, registrá el motivo, evento y operador antes de reprocesar.

# Carril 03 · validación local

Validado localmente el 11 de octubre de 2026:

- `corepack yarn workspace @rsvp/platform-messaging test`: 5/5 pruebas en verde.
- Cobertura funcional: sobre con `correlationId`, `tenant` y `payload`; routing key; confirms; ACK manual; cuatro delays; parking; topología durable y rechazo de contexto inválido.
- La topología crea exchanges de eventos, parking y un exchange/cola TTL por delay. Esto evita que un mismo evento se enrute a los cuatro retries simultáneamente y conserva la routing key original cuando RabbitMQ lo devuelve por DLX.

La integración real contra RabbitMQ permanece pendiente del stack Docker local: el intento anterior quedó bloqueado por un `500` del daemon al descargar MailHog, registrado en `docs/progress/BLOCKERS.md`. No se declara esa integración como ejecutada.

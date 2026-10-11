# Observabilidad

## Seguir una acción punta a punta

1. Tomá `X-Correlation-Id` de la respuesta de Kong o del log JSON.
2. En Grafana > Explore > Tempo, buscá `resource.service.name` y el atributo
   `correlationId`; HTTP, outbox, publicación, consumo y notificación deben
   pertenecer al mismo `traceId`.
3. Si falta un tramo, abrí los logs Loki del servicio por `correlationId` y
   comprobá `rsvp_outbox_lag_seconds` en el dashboard **RSVP Outbox**.

## Mensaje en parking

La alerta `RsvpParkingQueueNotEmpty` se activa tras 30 segundos con profundidad
mayor que cero. Leé primero el motivo del header, corregí la causa y reprocesá
el mensaje con su mismo `eventId`; el inbox lo hace idempotente. No vacíes la
cola para ocultar la alerta.

## Instrumentación por runtime

- NestJS: iniciá el SDK OpenTelemetry antes de crear la app y propagá
  `traceparent` y `correlationId` dentro del sobre del evento.
- Spring Boot: configurá el exporter OTLP a `http://otel-collector:4318` y
  añadí `correlationId` como atributo de logs/MDC.
- Django: configurá `opentelemetry-distro` con el mismo endpoint OTLP y un
  formatter JSON que pase por la capa de redacción.

No registrar email, teléfono, token, contraseña ni Authorization: el logger de
plataforma redacta esos campos al serializar, no en cada llamada individual.

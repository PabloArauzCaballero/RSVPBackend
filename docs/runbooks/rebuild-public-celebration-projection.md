# Reconstruir la proyección pública de las celebraciones

`read_public_celebration` se construye solo a partir de eventos. El historial completo es el outbox de `celebration_db` (`outbox_event`, ordenado por `event_sequence`), así que la proyección se puede borrar y reconstruir sin perder nada.

## Cuándo

- Una fila pública no coincide con la celebración (contenido, idioma, template).
- Cambió la forma del documento proyectado en una versión nueva del servicio.
- Se restauró `celebration_db` desde un backup.

## Cómo

Con el servicio corriendo, como administrador de plataforma:

```bash
curl -X POST http://localhost:8000/celebrations/admin/projections/public/replay \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# {"applied": 1234}
```

Sin el servicio, desde una máquina con acceso a la base:

```bash
CELEBRATION_DATABASE_URL=postgresql://celebration_owner:...@host:5432/celebration_db \
  yarn workspace @rsvp/celebration-site-service replay
```

Las dos vías borran la tabla y sus marcas de eventos procesados, y reaplican el historial en orden. El consumidor es idempotente y descarta eventos más viejos que la fila, de modo que los mensajes que lleguen por RabbitMQ durante el replay no la corrompen.

## Verificar

1. `GET /celebrations/public/{slug}` en cada idioma soportado (`Accept-Language`).
2. Una celebración en `DRAFT` o `ARCHIVED` responde 404.
3. La suite `yarn workspace @rsvp/celebration-site-service test:integration` compara la tabla antes y después del replay byte a byte.

Nunca se edita el JSON de `read_public_celebration` a mano: RLS solo deja escribir al proyector (`app.projector = on`).

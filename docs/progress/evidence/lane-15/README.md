# Carril 15 · Read model del sitio público

| REQ | Estado | Prueba |
|---|---|---|
| REQ-15-01 proyectada por evento | PASS | `http.test.mjs` REQ-15 · `postgres.integration` (outbox → relay → RabbitMQ → consumidor → `read_public_celebration`) |
| REQ-15-02 una sola lectura, sin tocar el modelo de escritura | PASS | `postgres.integration` REQ-15-02: exactamente una consulta SQL, solo sobre `read_public_celebration` |
| REQ-15-03 consumo idempotente | PASS | `http.test.mjs` REQ-15-03/04 (el historial aplicado 3 veces deja la proyección idéntica) |
| REQ-15-04 reconstrucción por replay | PASS | `http.test.mjs` y `postgres.integration`: borrar, reproducir desde el outbox y comparar byte a byte |
| REQ-15-05 no publicada → 404 | PASS | `http.test.mjs` REQ-15 (un borrador da 404; una despublicada desaparece) |
| REQ-15-06 traducciones incluidas | PASS | `http.test.mjs` REQ-15 (cambiar de idioma no hace otra consulta: todas las traducciones están en la fila) |

Replay en producción: `yarn workspace @rsvp/celebration-site-service replay` o `POST /celebrations/admin/projections/public/replay` (ADMIN). Ver el [runbook](../../../runbooks/rebuild-public-celebration-projection.md).

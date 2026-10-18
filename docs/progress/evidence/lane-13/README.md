# Carril 13 · Publicación validada por tipo

| REQ | Estado | Prueba |
|---|---|---|
| REQ-13-01 publicar solo con los campos del tipo | PASS | `domain.test.mjs` REQ-13-01/02 |
| REQ-13-02 el 422 enumera exactamente qué falta | PASS | `http.test.mjs` REQ-13 (`missingFields: ["eventDate"]`); boda y quinceaños exigen campos distintos |
| REQ-13-03 `CelebrationPublished.v1` por outbox | PASS | `http.test.mjs` y `contracts.test.mjs` |
| REQ-13-04 despublicar es auditable | PASS | `http.test.mjs` REQ-13 (`/audit` guarda actor, fecha y motivo) · evento `celebration.celebration.unpublished.v1` añadido al catálogo |
| REQ-13-05 `ARCHIVED` es terminal | PASS | `domain.test.mjs` REQ-10-03 · `http.test.mjs` (publicar una archivada → 409) |
| REQ-13-06 slug usado → 409 | PASS | `http.test.mjs` y `postgres.integration` REQ-13-06 |

Para el frontend (F12): `GET /celebrations/{id}/publish-check` devuelve la misma lista sin intentar la transición.

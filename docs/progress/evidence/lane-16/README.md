# Carril 16 · Templates y media en Django

| REQ | Estado | Prueba |
|---|---|---|
| REQ-16-01 solo `PUBLISHED` y compatibles | PASS | `tests/test_api.py` REQ-16-01 (un quinceaños no ve "Clásico marfil"; un borrador no aparece) |
| REQ-16-02 subida por URL prefirmada | PASS | `test_api.py` REQ-16-02 (el servicio no guarda bytes) · `test_infrastructure.py` (PUT real a MinIO) · `e2e/gateway/leo-live.mjs` |
| REQ-16-03 MIME y tamaño antes de firmar → 422 | PASS | `test_template_media.py` y `test_api.py` REQ-16-03; al confirmar se vuelve a verificar contra el objeto guardado (tipo, tamaño y formato real con Pillow) |
| REQ-16-04 variantes thumb, medium, full, webp | PASS | `test_template_media.py` (320/960/1920 px, WebP, EXIF con GPS eliminado) · `test_infrastructure.py` (las cuatro existen en MinIO) |
| REQ-16-05 cambiar de template no borra contenido | PASS | `test_template_media.py` y `test_api.py` REQ-16-05 (A → B → A idéntico; las secciones que el template no ubica se ocultan, no se borran) · del lado de Celebration: `http.test.mjs` REQ-16-05 |
| REQ-16-06 sobre idéntico al de NestJS | PASS | `test_contract.py` (compara con el sobre generado por el código TypeScript) y `contracts.test.mjs` (al revés); ambos validan contra AsyncAPI |

Tenancy: `celebration_access` se alimenta de los eventos `celebration.*` (inbox idempotente, control por versión) y aplica la misma política que Celebration: un extraño recibe 404 y un VIEWER 403. RLS forzada en las seis tablas, probada como `template_owner` (`test_infrastructure.py`).

Hallazgo corregido gracias a la prueba con RLS real: un scope heredaba la bandera `consumer` puesta antes en la misma transacción. `apply_scope` escribe ahora todas las banderas en cada llamada.

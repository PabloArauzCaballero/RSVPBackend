# Carril 16 · Templates y media en Django

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [05](../calendario/semana-05.md) · 16 de noviembre al 20 de noviembre de 2026 |
| **Componente** | `apps/template-media-service` · Django + DRF |
| **Predecesores** | 11 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El único servicio en Python. Administra el catálogo de templates y los archivos de media, con subida directa a MinIO por URL prefirmada. Su outbox y su sobre de evento deben ser idénticos a los de NestJS, y eso no lo garantiza ningún compilador: lo garantiza el test de contrato.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-16-01` | `Template` con estado, tags por tipo de evento y estructura de secciones | Solo los `PUBLISHED` y compatibles aparecen como opción |
| `REQ-16-02` | Subida por URL prefirmada a MinIO | El archivo nunca pasa por el servicio |
| `REQ-16-03` | Validación de tipo MIME y tamaño antes de firmar | Un archivo no permitido se rechaza con 422 |
| `REQ-16-04` | Variantes generadas: thumb, medium, full y webp | Las cuatro existen tras la subida |
| `REQ-16-05` | **Cambiar de template no borra contenido del dominio** | Cambiar y volver al original deja la celebración idéntica |
| `REQ-16-06` | **El sobre de evento es idéntico al de NestJS** | El test de contrato compara la estructura campo por campo |

---

## Qué se construye

- `apps/template-media-service/templates_app/models.py`
- `apps/template-media-service/templates_app/serializers.py`
- `apps/template-media-service/templates_app/views.py`
- `apps/template-media-service/media_app/storage.py`
- `apps/template-media-service/outbox/`
- `apps/template-media-service/tests/`
- `apps/template-media-service/pyproject.toml`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Subir un recurso permitido y obtenerlo desde un template publicado; rechazar formato inválido.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-16-01, REQ-16-02, REQ-16-03, REQ-16-04, REQ-16-05, REQ-16-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F12 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F12 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Modelos, migraciones y serializadores de `Template`.
2. Subida prefirmada a MinIO con validación previa.
3. Generación de variantes y registro de `MediaAsset`.
4. Outbox en Django con el mismo sobre y verificación por Pact.

---

## Plan de pruebas

- pytest con Testcontainers de Postgres y MinIO.
- Test de contrato del sobre contra el esquema compartido de AsyncAPI.
- **Test de que cambiar de template preserva el contenido.**
- Test de rechazo de MIME y de tamaño.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El outbox de Django pasa exactamente las mismas pruebas de contrato que el de NestJS.
- [ ] La generación de variantes no bloquea la respuesta de la subida.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-16/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Es fácil terminar el carril con todo funcionando y el sobre de evento ligeramente distinto. Hacé el test de contrato el primer día, no el último.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 16 completo
```

# Carril 13 · Publicación validada por tipo

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `apps/celebration-site-service` |
| **Predecesores** | 11 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Publicar una celebración es la transición que la hace visible al mundo. Los campos obligatorios no están en el código: salen del `EventTypeDefinition`, así que una boda y un quinceaños exigen cosas distintas sin que eso sea una rama condicional.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-13-01` | `DRAFT → PUBLISHED` solo con todos los campos obligatorios del tipo | Falta un campo y la transición se rechaza |
| `REQ-13-02` | El 422 enumera exactamente qué falta | La respuesta lista los campos faltantes, no un mensaje genérico |
| `REQ-13-03` | `CelebrationPublished.v1` por outbox | Gift List y Guest/RSVP reaccionan a la publicación |
| `REQ-13-04` | Volver a `DRAFT` desde `PUBLISHED` está permitido y es auditable | Queda registro de quién despublicó y cuándo |
| `REQ-13-05` | `ARCHIVED` es terminal | Desde archivado no se vuelve a publicar |
| `REQ-13-06` | Un `slug` ya usado devuelve 409 | La unicidad es global, no por organización |

---

## Qué se construye

- `apps/celebration-site-service/src/domain/policy/publish-validation.ts`
- `apps/celebration-site-service/src/application/command/publish-celebration.ts`
- `apps/celebration-site-service/src/domain/event/celebration-published.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Política de validación que lee `requiredFieldsForPublish` del tipo.
2. Comando de publicación con el 422 enumerado.
3. Evento de publicación por outbox.
4. Transiciones de despublicación y archivado, con auditoría.

---

## Plan de pruebas

- Publicar una boda sin fecha: 422 con `eventDate` en la lista.
- Publicar un quinceaños al que le falta otro campo distinto: 422 con ese campo.
- Publicar con todo completo: 200 y evento en outbox.
- Archivar y luego intentar publicar: 409.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La lista de campos obligatorios de cada tipo está en el seed, no en el código.
- [ ] El mensaje de error es accionable desde la interfaz sin traducción adicional.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-13/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un 422 genérico obliga al usuario a adivinar. Enumerar los campos faltantes es la diferencia entre una pantalla usable y una frustrante.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 13 completo
```

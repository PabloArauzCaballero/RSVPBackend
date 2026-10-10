# Carril 11 · Tipos de evento dirigidos por datos

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `apps/celebration-site-service` |
| **Predecesores** | 10 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Soportar bodas, quinceaños, bautizos, aniversarios, cumpleaños y eventos corporativos sin programar uno por uno. El tipo vive en una tabla y declara qué roles tiene el anfitrión, qué secciones se habilitan, qué campos son obligatorios para publicar y qué templates son compatibles.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-11-01` | `EventTypeDefinition` persistido, no codificado | No existe ningún `switch` ni `if` sobre el tipo de evento en el código |
| `REQ-11-02` | `hostRoles` por tipo | Boda devuelve `[BRIDE, GROOM]`; quinceaños devuelve `[CELEBRANT]` |
| `REQ-11-03` | `requiredFieldsForPublish` por tipo | Dos tipos distintos exigen campos distintos para publicar |
| `REQ-11-04` | `compatibleTemplateTags` por tipo | Un template de boda no aparece como opción en un quinceaños |
| `REQ-11-05` | Traducciones por locale en `event_type_translations` | El mismo tipo se muestra en `es-BO` y en `en-US` |
| `REQ-11-06` | **Añadir un tipo nuevo no requiere desplegar** | Insertar el seed de BAUTIZO y publicar una celebración de ese tipo, sin tocar código |

---

## Qué se construye

- `apps/celebration-site-service/src/domain/model/event-type-definition.ts`
- `apps/celebration-site-service/prisma/seed/event-types.ts`
- `apps/celebration-site-service/prisma/seed/event-type-translations.ts`
- `apps/celebration-site-service/src/application/query/get-event-types.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Modelo y migración de `EventTypeDefinition` y sus traducciones.
2. Seeds de WEDDING y QUINCEANERA con sus roles, secciones y campos obligatorios.
3. Consulta de tipos disponibles por locale.
4. Prueba de extensibilidad: BAUTIZO solo con un seed.

---

## Plan de pruebas

- **Test de extensibilidad**: insertar BAUTIZO por seed, crear una celebración de ese tipo y publicarla, sin recompilar.
- Test de que no existe ninguna rama condicional sobre el código de tipo en el dominio.
- Test de fallback de traducción a `defaultLocale`.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Un tipo de evento nuevo se documenta como «insertar una fila», no como una tarea de desarrollo.
- [ ] Los seeds están versionados y son idempotentes.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-11/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Es el carril que más fácil se hace mal. Un `switch (tipo)` funciona hoy y obliga a desplegar la próxima vez que el cliente pida algo.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 11 completo
```

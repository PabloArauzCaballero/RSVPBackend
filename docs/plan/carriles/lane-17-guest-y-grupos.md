# Carril 17 · Invitados y grupos familiares

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [01](../calendario/semana-01.md) · 19 de octubre al 23 de octubre de 2026 |
| **Componente** | `apps/guest-rsvp-service` |
| **Predecesores** | Contract Freeze |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Modelar a quién se invita. Un invitado pertenece opcionalmente a un grupo familiar o mesa, tiene un número de acompañantes permitidos y un idioma preferido que manda en las notificaciones que recibe.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-17-01` | Agregados `Guest` y `GuestGroup` sin dependencias de framework | El test arquitectónico está verde |
| `REQ-17-02` | Alta individual con validación | Un email mal formado devuelve 422 con el campo señalado |
| `REQ-17-03` | **Importación CSV con reporte de errores por fila** | Un CSV con 3 filas inválidas devuelve las 3 con su número de línea y su motivo |
| `REQ-17-04` | La importación es atómica por lote o parcial, declarado explícitamente | El comportamiento está documentado y probado |
| `REQ-17-05` | `allowedCompanions` por invitado | El valor por defecto es configurable por celebración |
| `REQ-17-06` | `locale` por invitado con fallback al de la celebración | Un invitado sin idioma recibe el `defaultLocale` |

---

## Qué se construye

- `apps/guest-rsvp-service/src/domain/model/guest.ts`
- `apps/guest-rsvp-service/src/domain/model/guest-group.ts`
- `apps/guest-rsvp-service/src/application/command/register-guest.ts`
- `apps/guest-rsvp-service/src/application/command/import-guests-csv.ts`
- `apps/guest-rsvp-service/prisma/schema.prisma`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Agregados e invariantes con tests unitarios puros.
2. Persistencia, migración y endpoints de alta individual.
3. Grupos familiares y asignación de miembros.
4. Importación CSV con validación por fila y reporte detallado.

---

## Plan de pruebas

- Unitarios de invariantes de `Guest` y `GuestGroup`.
- Supertest de alta con 201, 422 y 404 cross-tenant.
- CSV válido, CSV con filas inválidas y CSV vacío.
- CSV con 1000 filas: el reporte sigue siendo legible y la operación no expira.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El formato de CSV está documentado con un archivo de ejemplo en el repositorio.
- [ ] El reporte de errores es suficiente para corregir el archivo sin adivinar.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-17/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Una importación que falla entera por una fila mala es inutilizable con listas de 200 invitados. Decidí el comportamiento a conciencia y documentalo.

---

## Preguntas abiertas

Lo que no se puede resolver sin el propietario no se inventa.

- ¿La importación debe ser atómica (todo o nada) o parcial (importa las válidas y reporta las malas)? El plan asume parcial.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 17 completo
```

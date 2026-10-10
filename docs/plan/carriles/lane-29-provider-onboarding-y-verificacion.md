# Carril 29 · Alta y verificación de proveedores

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [04](../calendario/semana-04.md) · 9 de noviembre al 13 de noviembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | Contract Freeze |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

La puerta de entrada del catálogo. Un proveedor se registra, carga su ficha y queda pendiente hasta que un administrador lo verifica. Sin esta barrera, el catálogo se llena de basura y el cliente internacional lo nota el primer día.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-29-01` | Agregado `Provider` sin dependencias de framework | El test arquitectónico está verde |
| `REQ-29-02` | Estados `DRAFT`, `PENDING_VERIFICATION`, `VERIFIED` y `SUSPENDED` | Transiciones explícitas, 409 en las prohibidas |
| `REQ-29-03` | **Solo `VERIFIED` aparece en búsqueda** | Un proveedor pendiente no es visible públicamente |
| `REQ-29-04` | Rol `PROVIDER` en Identity y propiedad del registro | Un proveedor solo edita lo suyo |
| `REQ-29-05` | Suspender retira de la búsqueda sin borrar datos | Los leads históricos se conservan |
| `REQ-29-06` | `plan` con valores `FREE`, `FEATURED` y `PREMIUM` | Insumo del ranking del carril 32 |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/provider.ts`
- `apps/provider-catalog-service/src/application/command/register-provider.ts`
- `apps/provider-catalog-service/src/application/command/verify-provider.ts`
- `apps/provider-catalog-service/prisma/schema.prisma`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Agregado y máquina de estados con tests unitarios.
2. Alta de proveedor y carga de ficha.
3. Verificación y suspensión por administrador.
4. Filtrado por estado en todas las consultas públicas.

---

## Plan de pruebas

- Proveedor pendiente no aparece en búsqueda pública.
- Verificación por un usuario sin rol de administrador: 403.
- Suspensión: desaparece de búsqueda, conserva sus leads.
- Transiciones prohibidas: 409.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Ninguna consulta pública devuelve proveedores no verificados.
- [ ] El flujo de verificación está documentado para el administrador.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-29/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Olvidar el filtro de estado en una sola consulta expone proveedores sin verificar. Conviene centralizar el filtro en el repositorio.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 29 completo
```

# Carril 10 · Dominio de Celebration y tenancy

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [01](../calendario/semana-01.md) · 19 de octubre al 23 de octubre de 2026 |
| **Componente** | `apps/celebration-site-service` |
| **Predecesores** | Contract Freeze |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El agregado raíz de toda la plataforma. Una `Celebration` no es una boda: es cualquier evento con anfitrión, invitados, regalos y proveedores. Además es el tenant: cada fila de cada servicio cuelga de un `celebrationId`.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-10-01` | Agregado `Celebration` sin dependencias de framework | El test arquitectónico falla si `domain/` importa NestJS o Prisma |
| `REQ-10-02` | `slug` único global e inmutable tras publicar | Intentar cambiarlo en estado `PUBLISHED` devuelve 409 |
| `REQ-10-03` | Estados `DRAFT`, `PUBLISHED` y `ARCHIVED` con transiciones explícitas | Una transición no permitida devuelve 409, no 500 |
| `REQ-10-04` | Lock optimista con columna `version` | Dos ediciones concurrentes: una gana, la otra recibe 409 |
| `REQ-10-05` | `organizationId` opcional para wedding planners | Un planner ve las celebraciones de su organización y ninguna otra |
| `REQ-10-06` | **Aislamiento por tenant en todos los endpoints** | Pedir una celebración ajena devuelve 404, no 403 |

---

## Qué se construye

- `apps/celebration-site-service/src/domain/model/celebration.ts`
- `apps/celebration-site-service/src/domain/port/`
- `apps/celebration-site-service/src/application/command/`
- `apps/celebration-site-service/src/infrastructure/persistence/prisma/`
- `apps/celebration-site-service/src/interface/rest/`
- `apps/celebration-site-service/prisma/schema.prisma`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Crear y leer una celebración de un tenant por API y persistencia reales; un segundo tenant recibe 404.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-10-01, REQ-10-02, REQ-10-03, REQ-10-04, REQ-10-05, REQ-10-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F11 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F11 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Agregado, value objects e invariantes, con tests unitarios puros.
2. Persistencia con Prisma, migración y lock optimista.
3. Endpoints REST de creación y edición con validación Zod.
4. Tenancy: guard, filtrado obligatorio en repositorios y test de fuga.

---

## Plan de pruebas

- Unitarios de todas las transiciones de estado, incluidas las prohibidas.
- Integración con Testcontainers: lock optimista con dos escrituras concurrentes.
- Supertest de los endpoints con 200, 400, 404, 409 y 422.
- Fuga cross-tenant en cada endpoint.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Ningún repositorio acepta una consulta sin `celebrationId`.
- [ ] Row Level Security activa en todas las tablas del servicio.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-10/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- La tentación de llamarlo `Wedding` «por ahora» deja deuda semántica en los siete servicios. El nombre es parte del diseño.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 10 completo
```

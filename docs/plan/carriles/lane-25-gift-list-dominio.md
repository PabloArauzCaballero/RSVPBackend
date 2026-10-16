# Carril 25 · Dominio de la lista de regalos

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [01](../calendario/semana-01.md) · 19 de octubre al 23 de octubre de 2026 |
| **Componente** | `apps/gift-list-service` |
| **Predecesores** | Contract Freeze |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

La máquina de estados más rica del proyecto, y por eso el carril de referencia que los demás copian. Un regalo pasa por disponible, pendiente de revisión, comprometido, rechazado o propuesto, y cada transición tiene dueño y condición.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-25-01` | Agregados `GiftList`, `GiftItem` y `GiftReservation` sin framework | El test arquitectónico está verde |
| `REQ-25-02` | Cinco estados con transiciones explícitas | Una transición no permitida devuelve 409, no 500 |
| `REQ-25-03` | `Money` como entero en unidades menores más moneda | No existe ningún `float` para precios |
| `REQ-25-04` | `source` distingue catalogado de externo | Un catalogado referencia un producto de partner |
| `REQ-25-05` | Columna `version` para lock optimista | Preparada para el carril 26 |
| `REQ-25-06` | Una lista por celebración | Crear la segunda devuelve 409 |

---

## Qué se construye

- `apps/gift-list-service/src/domain/model/gift-list.ts`
- `apps/gift-list-service/src/domain/model/gift-item.ts`
- `apps/gift-list-service/src/domain/model/gift-reservation.ts`
- `apps/gift-list-service/src/domain/policy/reservation-state-machine.ts`
- `apps/gift-list-service/prisma/schema.prisma`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Crear un regalo en una lista de celebración y leerlo por API con aislamiento de tenant.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-25-01, REQ-25-02, REQ-25-03, REQ-25-04, REQ-25-05, REQ-25-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F23 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F23 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Agregados y value objects, con tests unitarios puros.
2. Máquina de estados como política pura, con tabla de casos.
3. Persistencia, migración y lock optimista.
4. Endpoints de creación de lista y alta de regalos.

---

## Plan de pruebas

- Tabla de casos con las 25 combinaciones de estado y transición: permitidas y prohibidas.
- Unitarios de `Money` con BOB y USD.
- Supertest con 201, 409 y 422.
- Fuga cross-tenant en todos los endpoints.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La estructura hexagonal de este servicio es la que copian los otros seis. Documentada como tal.
- [ ] La máquina de estados está en un solo archivo de política pura, no dispersa en handlers.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-25/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Es el carril de referencia. Si la estructura sale torcida, se replica torcida seis veces.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 25 completo
```

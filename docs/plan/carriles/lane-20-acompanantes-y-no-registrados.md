# Carril 20 · Acompañantes y asistentes no registrados

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `apps/guest-rsvp-service` |
| **Predecesores** | 19 · 12 (Leo) |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Las dos excepciones que el anfitrión controla con sus interruptores. Pedir más acompañantes de los permitidos, y confirmar asistencia sin estar en la lista. Cada una se comporta distinto según el modo.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-20-01` | `requestedCompanions ≤ allowedCompanions` por defecto | Pasarse con el modo RESTRICTED no confirma de más |
| `REQ-20-02` | Con `extraCompanionMode = AUTO_ACCEPT` el exceso se aprueba solo | `approvedCompanions` iguala a `requested` |
| `REQ-20-03` | Con `RESTRICTED` el exceso crea `CompanionRequest(PENDING_REVIEW)` | El RSVP queda CONFIRMED con los permitidos y la solicitud en la bandeja |
| `REQ-20-04` | Con `unregisteredRsvpMode = AUTO_ACCEPT` un desconocido puede confirmar | Se crea `Guest` y `Rsvp` en CONFIRMED |
| `REQ-20-05` | Con `RESTRICTED` el desconocido recibe 403 | No se filtra información de la celebración |
| `REQ-20-06` | **El modo se evalúa en el instante del comando** | Cambiar el modo después no altera lo ya resuelto |

---

## Qué se construye

- `apps/guest-rsvp-service/src/domain/model/companion-request.ts`
- `apps/guest-rsvp-service/src/domain/policy/companion-policy.ts`
- `apps/guest-rsvp-service/src/application/command/request-extra-companions.ts`
- `apps/guest-rsvp-service/src/application/command/resolve-companion-request.ts`
- `apps/guest-rsvp-service/src/interface/consumer/celebration-settings.consumer.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Añadir un acompañante permitido a un RSVP y comprobar límite y rechazo de acompañante no autorizado.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-20-01, REQ-20-02, REQ-20-03, REQ-20-04, REQ-20-05, REQ-20-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F15 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F15 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Consumidor de `CelebrationSettingsUpdated.v1` y caché local de los modos.
2. Política de acompañantes con los dos modos.
3. Flujo de no registrados con los dos modos.
4. Resolución de solicitudes por el anfitrión y sus eventos.

---

## Plan de pruebas

- Los cuatro cruces: acompañantes AUTO y RESTRICTED, no registrados AUTO y RESTRICTED.
- Test de no-retroactividad acordado con Leo.
- Test de idempotencia del consumidor de ajustes.
- Fuga cross-tenant en los endpoints nuevos.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Los cuatro cruces están en una tabla de casos parametrizada, no en cuatro tests copiados.
- [ ] El comportamiento con el modo ausente (por si el evento no llegó) está definido y es el seguro.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-20/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Si el consumidor de ajustes no llegó todavía, hay que decidir qué hace el servicio. El valor seguro es RESTRICTED, nunca AUTO.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 20 completo
```

# Carril 22 · Derecho al olvido

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [04](../calendario/semana-04.md) · 9 de noviembre al 13 de noviembre de 2026 |
| **Componente** | `apps/guest-rsvp-service` + consumidores en Gift y Notification |
| **Predecesores** | 21 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Un invitado puede pedir que sus datos desaparezcan. La anonimización se propaga por evento a todos los servicios que guardaron algo suyo, y después no queda información personal en ninguna base, log o evidencia.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-22-01` | `GuestErasureRequested.v1` disparado por el titular o por el anfitrión | El evento sale por outbox |
| `REQ-22-02` | Anonimización en `Guest` y `Rsvp` conservando los agregados | Los contadores del resumen no cambian; los nombres sí |
| `REQ-22-03` | Gift List y Notification consumen y anonimizan lo suyo | El nombre del solicitante de una reserva desaparece |
| `REQ-22-04` | **No queda información personal en logs ni evidencias** | Una búsqueda del email borrado en todo el stack no lo encuentra |
| `REQ-22-05` | Consentimiento con marca de tiempo al registrarse | `consentGivenAt` persistido y auditable |
| `REQ-22-06` | Retención configurable por celebración | El plazo es un ajuste, no una constante del código |

---

## Qué se construye

- `apps/guest-rsvp-service/src/application/command/request-erasure.ts`
- `apps/guest-rsvp-service/src/domain/policy/anonymization.ts`
- `apps/gift-list-service/src/interface/consumer/guest-erasure.consumer.ts`
- `apps/notification-service/src/interface/consumer/guest-erasure.consumer.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Consentimiento y su registro al dar de alta un invitado.
2. Comando de borrado y política de anonimización local.
3. Consumidores de anonimización en Gift y Notification.
4. Verificación de ausencia de PII en logs y evidencias.

---

## Plan de pruebas

- **Barrido de PII**: borrar un invitado y buscar su email y teléfono en base, logs, trazas y evidencias.
- Test de que el resumen agregado no cambia tras la anonimización.
- Test de idempotencia de los tres consumidores.
- Test de que un borrado no afecta a invitados de otra celebración.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La anonimización es irreversible y está documentada como tal.
- [ ] El plazo de retención está declarado y es configurable.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-22/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Anonimizar en un servicio y olvidar otro es peor que no anonimizar: da falsa seguridad. El barrido tiene que cubrir los siete.

---

## Preguntas abiertas

Lo que no se puede resolver sin el propietario no se inventa.

- El plazo concreto de retención y si hay exigencia de residencia de datos en la UE dependen del contrato con el cliente.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 22 completo
```

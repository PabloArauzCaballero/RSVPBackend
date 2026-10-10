# Carril 03 · Mensajería RabbitMQ

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `packages/platform-messaging` |
| **Predecesores** | 02 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Una librería que los cinco servicios NestJS usan tal cual para publicar y consumir eventos, con la topología declarada en código, confirmaciones de publicación, reintentos escalonados y cola de aparcamiento. Spring y Django replican el mismo contrato de sobre, no la librería.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-03-01` | Topología declarativa: 7 exchanges topic, colas por consumidor y patrón | Levantar el broker vacío y que la librería lo deje configurado al arrancar |
| `REQ-03-02` | Publisher con confirms | Un publish a un exchange inexistente rechaza, no se pierde en silencio |
| `REQ-03-03` | Consumer base con ACK manual y `prefetch` 10 | Un consumidor que lanza excepción no pierde el mensaje |
| `REQ-03-04` | Reintentos escalonados de 5 s, 30 s, 2 min y 10 min vía DLX | Un consumidor que falla siempre acumula 4 intentos con esos retardos |
| `REQ-03-05` | Al quinto fallo el mensaje va a la cola de aparcamiento | La cola `<ctx>.parking` recibe el mensaje con el motivo en los headers |
| `REQ-03-06` | Routing key `<contexto>.<entidad>.<hecho>.v<N>` | Un nombre que no cumple el patrón es rechazado en tiempo de registro |

---

## Qué se construye

- `packages/platform-messaging/src/topology/`
- `packages/platform-messaging/src/publisher/`
- `packages/platform-messaging/src/consumer/`
- `packages/platform-messaging/src/retry/`
- `packages/platform-messaging/src/envelope.ts`
- `packages/platform-messaging/test/`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Sobre de evento y validación del nombre de routing key.
2. Declaración de topología idempotente al arranque.
3. Publisher con confirms y publicación transaccional por lotes.
4. Consumer base con ACK manual, reintentos por DLX y aparcamiento.

---

## Plan de pruebas

- Integración con Testcontainers RabbitMQ: publicar y consumir de verdad, sin mocks.
- Test de reintentos que verifica los cuatro retardos con reloj controlado.
- Test de aparcamiento: un consumidor que falla siempre deja el mensaje en `parking` con el motivo.
- Test de contrato del sobre: un payload sin `correlationId` o sin `tenant` es rechazado.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La librería se usa sin configuración adicional desde un servicio NestJS de ejemplo.
- [ ] El runbook de reproceso manual desde la cola de aparcamiento está escrito y probado.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-03/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un `prefetch` alto parece más rápido y en realidad concentra el daño cuando algo falla.
- Si la topología no es idempotente, el segundo arranque falla y nadie entiende por qué.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 03 completo
```

# Carril 23 · Notificaciones: hexágono y canales

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [05](../calendario/semana-05.md) · 16 de noviembre al 20 de noviembre de 2026 |
| **Componente** | `apps/notification-service` |
| **Predecesores** | 04 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El servicio con la arquitectura hexagonal más estricta del proyecto. Un único puerto de salida y seis adaptadores: consola, Mailhog, SES o Resend, WhatsApp Business, Twilio y Expo Push. El dominio decide qué notificar; nunca cómo.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-23-01` | Un solo `NotificationChannelPort` en el dominio | **El dominio no importa ningún SDK de proveedor** |
| `REQ-23-02` | El canal se resuelve por configuración, no por condicional en el dominio | Cambiar de proveedor es cambiar una variable de entorno |
| `REQ-23-03` | Plantillas con i18n por locale del destinatario | Un invitado con `en-US` recibe el correo en inglés |
| `REQ-23-04` | Horario de silencio en la timezone de la celebración | Una notificación nocturna se difiere, no se descarta |
| `REQ-23-05` | Preferencias por usuario y por canal | Un usuario puede desactivar SMS y mantener push |
| `REQ-23-06` | **Consumo idempotente** | El mismo evento 3 veces produce una sola notificación |

---

## Qué se construye

- `apps/notification-service/src/domain/port/outbound/notification-channel.port.ts`
- `apps/notification-service/src/domain/model/notification-request.ts`
- `apps/notification-service/src/infrastructure/channel/console/`
- `apps/notification-service/src/infrastructure/channel/mailhog/`
- `apps/notification-service/src/infrastructure/channel/ses/`
- `apps/notification-service/src/infrastructure/channel/whatsapp/`
- `apps/notification-service/src/infrastructure/channel/twilio/`
- `apps/notification-service/src/domain/policy/quiet-hours.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Emitir una notificación desde un evento real hasta un canal de prueba verificable, con reintento acotado.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-23-01, REQ-23-02, REQ-23-03, REQ-23-04, REQ-23-05, REQ-23-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F18 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F18 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Dominio, puerto y plantillas i18n, sin ningún adaptador.
2. Adaptadores de consola y Mailhog; `FakeDriver` determinista para tests.
3. Adaptadores de correo real, WhatsApp y SMS, conmutables por entorno.
4. Horario de silencio, preferencias y consumidores idempotentes.

---

## Plan de pruebas

- **Test arquitectónico**: `domain/` no importa ningún SDK de proveedor.
- Test de idempotencia con el mismo evento entregado 3 veces.
- Test de plantillas en `es-BO` y `en-US`.
- Test de horario de silencio con una celebración en `America/La_Paz`.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Cambiar de proveedor de correo no toca ni una línea del dominio.
- [ ] Los tests nunca contactan un proveedor real.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-23/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un `if (canal === 'whatsapp')` dentro del dominio parece inocente y rompe todo el propósito del hexágono.
- Las plantillas con texto embebido en el código son imposibles de traducir después.

---

## Preguntas abiertas

Lo que no se puede resolver sin el propietario no se inventa.

- ¿Meta Cloud API o un proveedor local como intermediario de WhatsApp? El puerto es el mismo; cambia solo el adaptador.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 23 completo
```

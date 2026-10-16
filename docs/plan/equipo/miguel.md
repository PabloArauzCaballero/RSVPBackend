> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Miguel · Eje C — Invitados y Avisos

> Tenés el flujo que más usuarios finales toca: el invitado que abre un link y confirma. Y tenés la exigencia dura del cliente, que es **push real en iOS y Android**. Tu carril 24 y tu `F19` son los únicos que no se pueden demostrar con un test: necesitan un teléfono en la mano.

---

## Lo que te pertenece

| | |
|---|---|
| **Servicios** | Guest/RSVP Service (NestJS), Notification Service (NestJS) |
| **Bases de datos** | `guest_db`, `notification_db` |
| **Conceptos clave** | `Guest`, `GuestGroup`, `Rsvp`, tokens de acceso, proyecciones de asistencia, canales de notificación, device tokens |
| **Frontend** | RSVP público, gestión de invitados, notificaciones, push y app móvil del invitado |

---

## Tu calendario

| Semana | Fechas | Carriles | Foco |
|---|---|---|---|
| 00 | 12–16 oct | — | Contract Freeze. Definís el contrato de RSVP y el catálogo de eventos que consume Notification |
| 01 | 19–23 oct | [17](../carriles/lane-17-guest-y-grupos.md) | Dominio de invitados y grupos |
| 02 | 26–30 oct | [18](../carriles/lane-18-tokens-de-acceso-invitado.md) · [19](../carriles/lane-19-rsvp-confirmacion-y-edicion.md) | Tokens y el flujo central de RSVP |
| 03 | 2–6 nov | [20](../carriles/lane-20-acompanantes-y-no-registrados.md) · [21](../carriles/lane-21-read-models-invitados.md) | Acompañantes, no registrados y proyecciones |
| 04 | 9–13 nov | [22](../carriles/lane-22-gdpr-derecho-al-olvido.md) | Derecho al olvido en cascada |
| 05 | 16–20 nov | [23](../carriles/lane-23-notification-hexagonal-canales.md) | Hexágono de notificaciones: email, WhatsApp, SMS |
| 06 | 23–27 nov | [24](../carriles/lane-24-push-ios-android-expo.md) | **Push iOS y Android con evidencia en dispositivo real** |
| 07 | 30 nov – 4 dic | — | Buffer + preparar handlers MSW y pantallas estáticas |
| 08 | 7–11 dic | F15 · F16 | RSVP público y gestión de invitados |
| 09 | 14–18 dic | F17 · F18 | Resumen, bandejas y notificaciones in-app |
| 10 🎄 | 21–25 dic | F19 | Push en la app, permisos y recepción |
| 11 🎄 | 28 dic – 1 ene | F20 | Acciones desde la notificación push |
| 12 | 4–8 ene | F21 | App móvil del invitado por deep link |
| 13 | 11–15 ene | F23 | Gestión de regalos del anfitrión + estabilización |

---

## Tus carriles de backend

| # | Carril | Entregable que lo cierra |
|---|---|---|
| [17](../carriles/lane-17-guest-y-grupos.md) | Invitados y grupos | Alta individual y CSV con reporte de errores por fila |
| [18](../carriles/lane-18-tokens-de-acceso-invitado.md) | Tokens de acceso | Revocado → 401, inexistente → 401, de otra celebración → 404; rate limit verificado |
| [19](../carriles/lane-19-rsvp-confirmacion-y-edicion.md) | RSVP | **Con reloj fijo: antes del deadline 200, después 409 `RsvpWindowClosed`** |
| [20](../carriles/lane-20-acompanantes-y-no-registrados.md) | Acompañantes y no registrados | Los 4 cruces de modo AUTO/RESTRICTED probados |
| [21](../carriles/lane-21-read-models-invitados.md) | Read models | `read_guest_summary` y `read_guest_list` reconstruibles por replay |
| [22](../carriles/lane-22-gdpr-derecho-al-olvido.md) | GDPR | Anonimización en cascada; cero PII en logs y evidencias |
| [23](../carriles/lane-23-notification-hexagonal-canales.md) | Canales | El dominio no conoce ningún SDK; mismo evento 3 veces → 1 notificación |
| [24](../carriles/lane-24-push-ios-android-expo.md) | Push | Batching ≤100, `DeviceNotRegistered` manejado, **push real en un iPhone y un Android** |

---

## Lo que esperás de los demás

| De quién | Qué | Para cuándo |
|---|---|---|
| Leo | `CelebrationSettings` con `unregisteredRsvpMode` y `extraCompanionMode` | fin semana 02 — te bloquea el carril 20 |
| Leo | `timeZone` y `rsvpDeadline` en el evento de celebración | fin semana 02 — te bloquea el carril 19 |
| Pablo | `platform-outbox` y `platform-messaging` | fin semana 02 |
| Pablo | `F05` con deep links verificados | fin semana 07 — te bloquea `F21` |
| Fabio | Eventos de regalo para notificar | fin semana 03 |

---

## Riesgos de tu eje

- **El push no se puede fingir.** `F19` y el carril 24 necesitan dominio verificado, cuentas de Apple Developer y Google Play, y dos teléfonos físicos. Si eso no está listo para la semana 6, el requisito queda `BLOCKED-EXTERNAL` y hay que decirlo ese lunes, no en enero.
- **El deadline de RSVP se prueba con reloj fijo, no esperando.** Si en algún test aparece un `sleep`, está mal escrito.
- **El token del invitado es la única credencial del flujo público.** Se guarda hasheado, se revoca, se limita por tasa y nunca aparece en un log. Es tu superficie de ataque principal.

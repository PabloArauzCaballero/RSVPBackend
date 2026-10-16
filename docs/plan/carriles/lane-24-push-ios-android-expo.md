# Carril 24 · Push en iOS y Android

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [06](../calendario/semana-06.md) · 23 de noviembre al 27 de noviembre de 2026 |
| **Componente** | `apps/notification-service` · Expo Push API |
| **Predecesores** | 23 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

La exigencia dura del cliente: notificación push real en los dos sistemas operativos. Es el único carril del proyecto que no se puede demostrar con un test automatizado; necesita dos teléfonos físicos y evidencia en el pull request.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-24-01` | Registro y baja de `DeviceToken` por usuario y plataforma | Un usuario con iPhone y Android recibe en ambos |
| `REQ-24-02` | Envío por lotes de hasta 100 mensajes | Un envío de 250 destinatarios se divide en 3 lotes |
| `REQ-24-03` | `DeviceNotRegistered` da de baja el token automáticamente | Desinstalar la app deja de generar errores en el siguiente envío |
| `REQ-24-04` | Reintentos y registro de `DeliveryAttempt` | Un fallo transitorio se reintenta; uno permanente se registra |
| `REQ-24-05` | `FakeDriver` determinista para las pruebas | La suite no contacta la API de Expo |
| `REQ-24-06` | **Push recibido en un iPhone y en un Android físicos** | Captura de pantalla de ambos en el pull request |

---

## Qué se construye

- `apps/notification-service/src/domain/model/device-token.ts`
- `apps/notification-service/src/infrastructure/channel/expo-push/`
- `apps/notification-service/src/application/command/register-device-token.ts`
- `docs/progress/evidence/lane-24/`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Registrar un dispositivo, enviar un push de prueba y observar estado de entrega o bloqueo externo real.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-24-01, REQ-24-02, REQ-24-03, REQ-24-04, REQ-24-05, REQ-24-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F19 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F19 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Modelo de `DeviceToken` y endpoints de registro y baja.
2. Adaptador de Expo Push con lotes de 100.
3. Manejo de `DeviceNotRegistered` y de errores de la API.
4. Prueba en dispositivos físicos y recolección de evidencia.

---

## Plan de pruebas

- Lote de 250 destinatarios dividido correctamente en 3 envíos.
- `DeviceNotRegistered` da de baja el token y no reaparece.
- `FakeDriver` cubre toda la suite sin red.
- **Verificación manual en iPhone y Android, documentada con capturas.**

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La evidencia en dispositivo real está en el pull request, no descrita de palabra.
- [ ] Si faltan las cuentas de tienda, el requisito queda `BLOCKED-EXTERNAL` con fecha y responsable.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-24/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- **Bloqueo externo real**: sin dominio verificado y sin cuentas de Apple Developer y Google Play, este carril no cierra. Hay que confirmarlo el lunes de la semana 6, no en enero.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 24 completo
```

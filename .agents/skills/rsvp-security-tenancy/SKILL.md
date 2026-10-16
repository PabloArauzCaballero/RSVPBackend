---
name: rsvp-security-tenancy
description: Revisa autorización por actor y objeto, aislamiento de tenant y privacidad en servicios backend de RSVP.
---

# Seguridad y tenancy backend

Usa esta skill al cambiar rutas, comandos, consultas, eventos o jobs que lean o muten datos de celebraciones, anfitriones, invitados, partners o proveedores. Sintetiza patrones de `multi-tenancy` y `authz-access-control` de AtlasPromptManager, ajustados a los límites de RSVP.

1. Identifica actor, rol, tenant y dueño de cada objeto, incluidos IDs anidados y listados. La autorización vive en el servicio dueño; una pantalla oculta o un UUID difícil de adivinar no la reemplaza.
2. Incluye el contexto de tenant en lecturas y escrituras, también en búsquedas, paginación, jobs y consumidores. Comprueba que el recurso hijo pertenezca al padre y al tenant autorizado antes de operar. Evita filtrar resultados después de una consulta amplia.
3. Para cambios de API, prueba al menos acceso permitido, sin sesión, rol insuficiente y objeto de otro tenant; observa el código y cuerpo de error contractual sin filtrar la existencia de recursos privados. Prueba que una mutación denegada no persista ni emita un evento.
4. En eventos y outbox, valida procedencia y contexto, y que reintentos no dupliquen efectos ni mezclen tenants. No coloques secretos, tokens ni contenido personal en logs, trazas, errores o evidencias.
5. Declara qué controles se ejecutaron realmente y qué casos quedaron sin entorno o datos de prueba. Remite los hallazgos al REQ y a la evidencia del carril o PR.

Consulta OWASP ASVS y los contratos propios si un control requiere detalle. No asumas que RLS, middleware o gateway cubren por sí solos la política de objeto.

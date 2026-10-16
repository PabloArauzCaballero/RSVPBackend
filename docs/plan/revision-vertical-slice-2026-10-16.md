# Replanificación por slices verticales · Backend · 2026-10-16

Esta revisión cubre los 36 carriles del repositorio y se aplica también a calendario, fichas de equipo y plan maestro. No altera REQs ni afirma que estén cumplidos. Los estados de ejecución y bloqueos se determinan por código y evidencia actual en `docs/progress/`. Las fechas H1–H6 son objetivos históricos: reestimar tras medir los primeros slices y dependencias externas; no adelantar estados por una fecha.

## Orden de trabajo obligatorio

1. Recargar skills en cada prompt. Leer `rsvp-vertical-slice`, `rsvp-code-graph`, skill de carril y evidencia; en interfaz también Impeccable, UI/UX Pro Max, accesibilidad, prueba visual y motion cuando aplique.
2. Verificar predecesores reales, consultar CodeGraph y confirmar flujo/código. Si falta índice, `corepack yarn graph:init`; no usar Graphify.
3. Empezar por el corte indicado abajo o por otro que reduzca un riesgo mayor documentado. Cada corte declara REQs, entrada, resultado, capas/repos, caso negativo y prueba. No construir todas las capas antes de probar.
4. Cuando cruza repos: contrato versionado del backend, consumo en frontend, prueba de compatibilidad e integración real cuando el entorno exista. Las PR y evidencias se vinculan; un mock no acredita backend.
5. Antes de cerrar cada corte, verificar comportamiento, regresión pertinente y evidencia. Para UI: evaluar con Impeccable y UI/UX Pro Max en el diseño vigente, mirar tamaños/plataformas afectados y estados. Para animación: propósito, reduced motion, interrupción y rendimiento. Backend puro marca gates visuales `N/A` justificado.

## Reestimación de hitos

El calendario de 14 semanas y las fechas H1–H6 no incluyen explícitamente tiempo de revisión visual, animación, indexación/discovery y prueba por slice. El primer ciclo debe medir duración de cortes completos, bloqueos de infraestructura y capacidad de los cuatro dueños. Actualizar `calendario/` y `equipo/` con esas medidas antes de comprometer fechas nuevas. La secuencia de dependencias y propiedad de dominio sigue vigente hasta decisión registrada.

## Primer corte por carril

| Carril | Primer resultado verificable | Cruce | Gate adicional |
|---|---|---|---|
| [01](carriles/lane-01-monorepo-y-toolchain.md) | Crear un workspace mínimo que compile y corra una prueba desde la raíz con la versión de Node/Yarn declarada. | sin pareja directa | API/evento/infra verificable |
| [02](carriles/lane-02-infra-local-docker-compose.md) | Levantar un servicio y su dependencia real con Compose; comprobar salud y caída controlada. | sin pareja directa | API/evento/infra verificable |
| [03](carriles/lane-03-platform-messaging-rabbitmq.md) | Publicar un evento mínimo y consumirlo una vez por RabbitMQ, incluyendo el caso de entrega repetida. | sin pareja directa | API/evento/infra verificable |
| [04](carriles/lane-04-platform-outbox-inbox.md) | Guardar un cambio y su outbox en una transacción; relay y consumidor observables con redelivery idempotente. | sin pareja directa | API/evento/infra verificable |
| [05](carriles/lane-05-platform-auth-tenant-context.md) | Autenticar una petición con tenant válido y rechazar otra de tenant ajeno en el mismo caso de uso. | sin pareja directa | API/evento/infra verificable |
| [06](carriles/lane-06-platform-telemetry.md) | Seguir una petición real con correlationId desde la entrada hasta un span del servicio y un log sin PII. | sin pareja directa | API/evento/infra verificable |
| [07](carriles/lane-07-identity-service.md) | Registrar una identidad mínima y autenticarla a través de la API pública con errores verificables. | sin pareja directa | API/evento/infra verificable |
| [08](carriles/lane-08-api-gateway-kong.md) | Pasar una petición autenticada por Kong hasta un servicio y comprobar una denegación real. | sin pareja directa | API/evento/infra verificable |
| [09](carriles/lane-09-ci-cd-y-pact-broker.md) | Ejecutar en CI una validación de contrato de un consumidor y observar fallo deliberado por incompatibilidad. | sin pareja directa | API/evento/infra verificable |
| [10](carriles/lane-10-celebration-dominio-y-tenancy.md) | Crear y leer una celebración de un tenant por API y persistencia reales; un segundo tenant recibe 404. | F11 frontend | API/evento/infra verificable |
| [11](carriles/lane-11-event-type-definition-multievento.md) | Crear un tipo de evento por datos y recuperar sus campos en la API con validación negativa. | F11 frontend | API/evento/infra verificable |
| [12](carriles/lane-12-celebration-settings-auto-restricted.md) | Configurar AUTO_ACCEPT en una celebración y comprobar una transición permitida y una denegada. | F13 frontend | API/evento/infra verificable |
| [13](carriles/lane-13-publicacion-y-validacion.md) | Publicar una celebración mínima válida por API y rechazar otra sin el campo exigido por su tipo. | F12 frontend | API/evento/infra verificable |
| [14](carriles/lane-14-i18n-timezone-moneda.md) | Guardar zona IANA y moneda de una celebración y exponer un instante formateable sin pérdida de precisión. | F06 frontend | API/evento/infra verificable |
| [15](carriles/lane-15-read-model-sitio-publico.md) | Publicar una celebración y leer su proyección pública por slug; comprobar ausencia de datos privados. | F10 frontend | API/evento/infra verificable |
| [16](carriles/lane-16-template-media-django.md) | Subir un recurso permitido y obtenerlo desde un template publicado; rechazar formato inválido. | F12 frontend | API/evento/infra verificable |
| [17](carriles/lane-17-guest-y-grupos.md) | Crear un invitado en un grupo de una celebración y leerlo solo desde ese tenant. | F16 frontend | API/evento/infra verificable |
| [18](carriles/lane-18-tokens-de-acceso-invitado.md) | Emitir un token de invitado, abrir un recurso permitido y rechazar token expirado o ajeno. | F15 frontend | API/evento/infra verificable |
| [19](carriles/lane-19-rsvp-confirmacion-y-edicion.md) | Confirmar una asistencia real con token y leer el estado actualizado; repetir la petición sin doble efecto. | F15 frontend | API/evento/infra verificable |
| [20](carriles/lane-20-acompanantes-y-no-registrados.md) | Añadir un acompañante permitido a un RSVP y comprobar límite y rechazo de acompañante no autorizado. | F15 frontend | API/evento/infra verificable |
| [21](carriles/lane-21-read-models-invitados.md) | Confirmar un RSVP y ver el conteo actualizado en una proyección, con reentrega idempotente. | F17 frontend | API/evento/infra verificable |
| [22](carriles/lane-22-gdpr-derecho-al-olvido.md) | Solicitar borrado de un invitado y verificar que deja de aparecer en API, proyección y eventos derivados pertinentes. | F16 frontend | API/evento/infra verificable |
| [23](carriles/lane-23-notification-hexagonal-canales.md) | Emitir una notificación desde un evento real hasta un canal de prueba verificable, con reintento acotado. | F18 frontend | API/evento/infra verificable |
| [24](carriles/lane-24-push-ios-android-expo.md) | Registrar un dispositivo, enviar un push de prueba y observar estado de entrega o bloqueo externo real. | F19 frontend | API/evento/infra verificable |
| [25](carriles/lane-25-gift-list-dominio.md) | Crear un regalo en una lista de celebración y leerlo por API con aislamiento de tenant. | F23 frontend | API/evento/infra verificable |
| [26](carriles/lane-26-reserva-concurrencia-y-aprobacion.md) | Reservar un regalo una vez y hacer competir dos reservas contra persistencia real; solo una vence. | F22 frontend | API/evento/infra verificable |
| [27](carriles/lane-27-modo-auto-accept-regalos.md) | Reservar un regalo con AUTO_ACCEPT y observar aprobación automática; contrastar modo manual. | F22 frontend | API/evento/infra verificable |
| [28](carriles/lane-28-regalos-catalogados-vs-externos.md) | Crear un regalo catalogado y otro externo; leer ambos con enlace y reglas propias verificadas. | F23 frontend | API/evento/infra verificable |
| [29](carriles/lane-29-provider-onboarding-y-verificacion.md) | Registrar un proveedor y consultar su estado de verificación; impedir publicación prematura. | F28 frontend | API/evento/infra verificable |
| [30](carriles/lane-30-listings-geo-bolivia-categorias.md) | Publicar un listing válido de una ciudad boliviana y hallarlo por categoría y ciudad. | F24 frontend | API/evento/infra verificable |
| [31](carriles/lane-31-motor-de-redireccion-y-leads.md) | Abrir /r/{listingId} y observar redirección y lead atribuido, sin enlace directo ni duplicado. | F27 frontend | API/evento/infra verificable |
| [32](carriles/lane-32-lead-config-dedupe-y-ranking.md) | Configurar una regla de lead y comprobar deduplicación de dos aperturas equivalentes. | F27 frontend | API/evento/infra verificable |
| [33](carriles/lane-33-read-model-metricas-partner.md) | Generar un lead y leer su métrica agregada en el portal del partner con control de acceso. | F28 frontend | API/evento/infra verificable |
| [34](carriles/lane-34-provider-availability.md) | Bloquear una franja horaria y observar que desaparece de la disponibilidad pública. | F26 frontend | API/evento/infra verificable |
| [35](carriles/lane-35-booking-request-concurrencia.md) | Solicitar una fecha disponible y provocar dos reservas concurrentes; una recibe conflicto. | F26 frontend | API/evento/infra verificable |
| [36](carriles/lane-36-quote-request-y-fulfillment.md) | Pedir una cotización y consultar su estado, incluyendo una respuesta inválida del proveedor. | F26 frontend | API/evento/infra verificable |

## Cierre por REQ

La ficha enumera todos los REQs. Después del primer corte, el dueño descompone los restantes en cortes de comportamiento con prueba propia y registra el mapa `REQ → slice → artefacto → resultado` en la evidencia. Ninguna lista histórica por componente se ejecuta literalmente como un plan por capas.

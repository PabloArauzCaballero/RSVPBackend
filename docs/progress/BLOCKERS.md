# Bloqueos

- Docker Desktop respondió `500 Internal Server Error` al descargar `mailhog/mailhog:v1.0.1` desde el engine local. La configuración valida con `docker compose config --quiet`, pero la prueba de healthchecks completa debe repetirse cuando el daemon vuelva a permitir pulls.
- La verificación real de JWT contra JWKS remoto en Kong requiere seleccionar/provisionar el plugin OIDC compatible con la distribución final de Kong; Kong OSS no lo hace de forma nativa con el plugin `jwt`.
- Pact Broker requiere URL y credenciales de la organización para que la verificación de proveedores sea real.
  - Eje B (Leo): mientras tanto, los contratos se verifican contra el catálogo AsyncAPI campo por campo y contra el código real de los consumidores (Gift List y Guest/RSVP) en `celebration-site-service/test/contracts.test.mjs`.
- **Identity (Pablo) emite JWT con solo `sub`.** Celebration y Template/Media leen además `roles` (`ADMIN`, `PLANNER`, `HOST`) y `organizationIds` del token. Sin esos claims, los planners y los administradores no pueden actuar: todo el mundo es un anfitrión simple. Pedido: añadirlos en `Rs256JwtService.issue`.
- **`@rsvp/platform-messaging` usa un sobre distinto del contrato** (`eventName` en lugar de `eventType`, sin `eventVersion`, `producer` ni `actor`). Los servicios de Leo publican el sobre del contrato AsyncAPI con su propio publicador AMQP; conviene alinear el paquete de plataforma con el contrato antes de que otro eje lo adopte.
- Identity no corre todavía en Docker Compose. Para el despliegue local, Celebration y Template/Media aceptan un JWKS estático en `IDENTITY_JWKS_JSON` (lo usa `e2e/gateway/leo-live.mjs`).

Pendiente externo para fases posteriores: dominio público verificado y cuentas Apple/Google para deep links y builds móviles.

# Estado de ejecución

| Fecha | Carril / fase | Estado | Evidencia |
|---|---|---|---|
| 2026-10-21 | Carril 07 · Identity · primer slice · Pablo | REGRESSION_VERIFIED del slice (carril no DONE; REQ-07-05/06 parciales, JWKS en Kong bloqueado) | Spring Boot + Postgres + Redis en Compose detrás de Kong; registro, login, refresh con detección de reuso y logout; JWT con `roles` y `organizationIds` aceptado por Celebration contra el JWKS real. 28 pruebas (Testcontainers), cobertura 95,5 %, vivo ×3. Ver [evidencia](evidence/lane-07/README.md). |
| 2026-10-17 | Carriles 10–16 · Leo backend | REGRESSION_VERIFIED (pendiente revisión de otro eje y Pact Broker) | Celebration (TS, hexagonal, pg + RabbitMQ) y Template/Media (Django + DRF + MinIO) contra infraestructura real: 68 pruebas, 96 % de cobertura, integración ×3 sin fallos, Django 32 pruebas ×3 con RLS y MinIO, despliegue en Docker verificado por Kong. Ver [evidencia](evidence/lanes-10-16.md). |
| 2026-10-11 | Carriles 25–36 · Fabio backend | IMPLEMENTED_WITH_EXTERNAL_BLOCKER | Dominios ejecutables de Gift List y Provider Catalog, migraciones, contratos y 9 tests verdes; concurrencia PostgreSQL/Pact/HTTP real bloqueada por Docker/Pact. |
| 2026-10-11 | Carriles 17-24 · Miguel backend | IMPLEMENTED_WITH_EXTERNAL_BLOCKER | Invitados, token, RSVP, proyecciones, borrado, notificaciones y Expo Push simulable probados tres veces; la recepción física de push permanece bloqueada. |
| 2026-10-10 | Semana 00 · Plataforma de Pablo | IN_PROGRESS | Base de monorepo, Compose y contratos iniciados. |
| 2026-10-10 | Carriles 01–09 · Pablo backend | IMPLEMENTED | 19 workspaces, 8 contratos OpenAPI, 49 eventos AsyncAPI, plataforma e Identity validados localmente; bloqueos externos registrados. |

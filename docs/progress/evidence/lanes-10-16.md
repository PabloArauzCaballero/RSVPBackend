# Evidencia de implementacion: carriles 10-16

Fecha: 2026-10-11

## Verificado localmente

- `corepack yarn workspace @rsvp/celebration-site-service test`: transiciones, slug inmutable, validacion 422, definicion dirigida por datos, fallback de locale, ajustes/autorizacion/outbox, aislamiento, lock optimista, proyeccion idempotente/replay/despublicacion y Money.
- `corepack yarn workspace @rsvp/template-media-service test`: catalogo compatible publicado, politica de firma MIME/tamano/variantes y forma del sobre AsyncAPI.
- Migraciones con `timestamptz`, RLS y tablas de agregado/tipos/proyeccion. El seed usa `ON CONFLICT` e incorpora BAUTIZO sin rama de codigo.

## Pendiente de verificacion externa

- Prisma/Postgres con RLS y concurrencia real: requiere Postgres activo y cliente Prisma, que no estan disponibles en este entorno.
- Firma/carga MinIO y worker de variantes: requiere MinIO y credenciales de object storage; el test actual verifica la politica y no sustituye ese runtime.
- Pact Broker y aprobacion de consumidores Miguel/Fabio requieren sus servicios/Broker remotos.

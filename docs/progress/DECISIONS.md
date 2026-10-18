# Decisiones

- La infraestructura local usa una instancia de PostgreSQL con siete bases y roles aislados; el aislamiento de datos de cada servicio queda explícito y los contenedores se mantienen razonables para desarrollo.
- Las credenciales de Compose son únicamente locales y están documentadas en `.env.example`; no se versionan secretos de entornos compartidos.
- Yarn 4 se invoca mediante `corepack yarn` hasta que se elimine el shim global de Yarn Classic de la máquina.
- MinIO local se obtiene de Quay con tags inmutables: el registro oficial de Docker Hub para `mc` ya no es resoluble en este entorno.
- La importación CSV de invitados es parcial: conserva filas válidas y devuelve un error corregible por cada fila inválida.
- Los magic links llevan 256 bits aleatorios y solamente se conserva SHA-256; nunca entran en eventos ni logs.
- Las proyecciones deduplican por id de evento y se reconstruyen por replay. Los modos ausentes se tratan como `RESTRICTED`.
- La entrega push se prueba con un driver falso. La recepción real requiere firmas y dispositivos físicos, por lo que no se declara completada automáticamente.

## Eje B (Leo) · 2026-10-17

- **Celebration Site Service sin NestJS ni Prisma.** El monorepo no tiene NestJS ni Prisma instalados y ningún otro servicio Node los usa. El servicio es TypeScript hexagonal sobre `node:http` + `pg` + `zod` + `amqplib`; el adaptador HTTP es una capa delgada que se puede reemplazar por un controlador Nest sin tocar dominio ni aplicación. Prisma tampoco sirve aquí: RLS forzada, `set_config` por transacción y las funciones `app_*` exigen SQL. El esquema Prisma queda como descripción de solo lectura (`db/schema.prisma`).
- **Migraciones SQL versionadas y reversibles** (`db/migrations/NNNN_*.up.sql` / `.down.sql`) aplicadas por un migrador propio que registra `schema_migrations`.
- **Tenancy en dos capas.** La aplicación decide 404 (no lo conoces) frente a 403 (lo ves pero no puedes cambiarlo); Postgres lo garantiza con RLS **forzada**, para que ni el rol dueño lea sin scope. El scope (`app.user_id`, `app.organization_ids`, `app.is_admin`) se fija con `set_config(..., true)` dentro de cada transacción, así una conexión del pool nunca arrastra el tenant anterior.
- **Acceso:** dueño, colaborador `CO_HOST` y `PLANNER` de la organización gestionan; `VIEWER` y miembros de la organización leen; `ADMIN` gestiona todo. La misma política existe en Template/Media (`media_app/access.py`), alimentada por eventos.
- **El slug es inmutable desde la primera publicación**, aunque la celebración vuelva a borrador: los enlaces ya compartidos por WhatsApp deben seguir funcionando.
- **Cambiar de tipo de evento solo en borrador y sin borrar contenido.** Los anfitriones del tipo anterior se conservan; la validación de roles aplica cuando se editan y la de publicación la marca como faltante.
- **Convención temporal del contenido:** `eventDate` y toda clave terminada en `At` son instantes. Se aceptan con offset (se guardan tal cual en UTC) o como hora de pared `YYYY-MM-DDTHH:mm` (se interpretan en la zona de la celebración: hueco de DST hacia adelante, solapamiento a la primera ocurrencia). La API devuelve `localTimes` calculados para que ningún cliente haga cuentas de zona horaria.
- **Settings no retroactivos por contrato:** el evento lleva `settingsVersion` y `effectiveFrom`; los consumidores nunca reevalúan solicitudes pendientes.
- **Nuevo evento `celebration.celebration.unpublished.v1`** (adición al catálogo v1). Despublicar no es "configurar"; tener su propio canal lo hace auditable y permite al read model quitar la fila sin adivinar.
- **El snapshot de los eventos de celebración incluye `ownerId` y `collaborators`** para que Template/Media autorice subidas sin llamar a Celebration. El read model público no los proyecta.
- **El outbox es el historial de eventos** del servicio (columna `event_sequence` para el orden total) y la fuente del replay del read model.
- **Template/Media mantiene copias locales por eventos**, en ambos sentidos: Celebration guarda `template_reference` desde `template.template.*.v1`, y Template/Media guarda `celebration_access` desde `celebration.*.v1`. Ninguno llama al otro de forma síncrona.
- **Variantes de imagen sincrónicas** al confirmar la subida (archivos ≤ 10 MiB): thumb 320, medium 960, full 1920 y webp, todas WebP. Volver a codificar elimina el EXIF, incluida la ubicación GPS de las fotos.
- **Colas por despliegue:** `CELEBRATION_QUEUE_PREFIX` y `TEMPLATE_MEDIA_QUEUE_PREFIX`. Dos entornos sobre el mismo broker con la misma cola se roban mensajes (lo encontró la integración con los contenedores levantados); las pruebas usan colas exclusivas y efímeras.
- **Las imágenes se construyen desde la raíz del repo** (`docker build -f apps/<svc>/Dockerfile .`) para usar los paquetes del workspace; `images.yml` sigue esa convención.


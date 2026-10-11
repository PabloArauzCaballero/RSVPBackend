# Decisiones

- La infraestructura local usa una instancia de PostgreSQL con siete bases y roles aislados; el aislamiento de datos de cada servicio queda explícito y los contenedores se mantienen razonables para desarrollo.
- Las credenciales de Compose son únicamente locales y están documentadas en `.env.example`; no se versionan secretos de entornos compartidos.
- Yarn 4 se invoca mediante `corepack yarn` hasta que se elimine el shim global de Yarn Classic de la máquina.
- MinIO local se obtiene de Quay con tags inmutables: el registro oficial de Docker Hub para `mc` ya no es resoluble en este entorno.
- La importación CSV de invitados es parcial: conserva filas válidas y devuelve un error corregible por cada fila inválida.
- Los magic links llevan 256 bits aleatorios y solamente se conserva SHA-256; nunca entran en eventos ni logs.
- Las proyecciones deduplican por id de evento y se reconstruyen por replay. Los modos ausentes se tratan como `RESTRICTED`.
- La entrega push se prueba con un driver falso. La recepción real requiere firmas y dispositivos físicos, por lo que no se declara completada automáticamente.

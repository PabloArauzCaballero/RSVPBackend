# Decisiones

- La infraestructura local usa una instancia de PostgreSQL con siete bases y roles aislados; el aislamiento de datos de cada servicio queda explícito y los contenedores se mantienen razonables para desarrollo.
- Las credenciales de Compose son únicamente locales y están documentadas en `.env.example`; no se versionan secretos de entornos compartidos.
- Yarn 4 se invoca mediante `corepack yarn` hasta que se elimine el shim global de Yarn Classic de la máquina.
- MinIO local se obtiene de Quay con tags inmutables: el registro oficial de Docker Hub para `mc` ya no es resoluble en este entorno.

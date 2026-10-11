# Gateway declarativo

Todas las rutas públicas y privadas se añaden a `infra/kong/kong.yml`; no se cambia Kong desde su consola.

## Añadir una ruta

1. Publicá primero el endpoint en su contrato OpenAPI.
2. Añadí el `service` y el `route` en `kong.yml`, con un prefijo exclusivo.
3. Indicá si es público con el tag `rsvp-public`; el resto lleva
   `rsvp-protected`. Las rutas públicas deben llevar rate limiting explícito.
4. Ejecutá `docker compose config --quiet` y una prueba entrando por `localhost:8000`.

## JWT/JWKS

Kong OSS no refresca JWKS remoto de forma nativa con el plugin `jwt`; la verificación dinámica contra `/.well-known/jwks.json` requiere el plugin OIDC disponible en la distribución que se despliegue o un plugin propio revisado. Hasta seleccionar la distribución de Kong, las rutas están declaradas y la validación definitiva de JWKS permanece bloqueada externamente: no se sustituye por una clave pública hardcodeada.

## Clasificación y controles actuales

Las rutas llevan el tag `rsvp-public` o `rsvp-protected`. Las únicas rutas
públicas de producto son `/identity` (sesión y JWKS), `/rsvp` y `/r`; las dos
últimas tienen límites locales explícitos. El plugin `correlation-id`, CORS y
el límite de 10 MiB se aplican globalmente.

Cuando se provisione OIDC/JWKS, agregalo únicamente a rutas `rsvp-protected`,
verificá una petición sin token con 401 en `localhost:8000`, y dejá una prueba
E2E. No se declara una protección JWT ficticia con una clave hardcodeada.


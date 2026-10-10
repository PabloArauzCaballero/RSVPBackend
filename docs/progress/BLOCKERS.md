# Bloqueos

- Docker Desktop respondió `500 Internal Server Error` al descargar `mailhog/mailhog:v1.0.1` desde el engine local. La configuración valida con `docker compose config --quiet`, pero la prueba de healthchecks completa debe repetirse cuando el daemon vuelva a permitir pulls.
- La verificación real de JWT contra JWKS remoto en Kong requiere seleccionar/provisionar el plugin OIDC compatible con la distribución final de Kong; Kong OSS no lo hace de forma nativa con el plugin `jwt`.
- Pact Broker requiere URL y credenciales de la organización para que la verificación de proveedores sea real.

Pendiente externo para fases posteriores: dominio público verificado y cuentas Apple/Google para deep links y builds móviles.

# CI/CD

Los pull requests ejecutan los contratos y las tareas Turbo afectadas; la matriz comprueba Node, Java 21 y Python 3.14. Los contratos se publican en GitHub Packages únicamente desde una etiqueta `contracts-v*`.

La verificación efectiva de Pact necesita configurar la variable de repositorio `PACT_BROKER_BASE_URL` y el token correspondiente. El workflow falla de forma explícita hasta que exista ese recurso externo: no simula una verificación de proveedor.


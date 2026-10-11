# CI/CD

Los pull requests ejecutan los contratos y las tareas Turbo afectadas; la matriz comprueba Node, Java 21 y Python 3.14. El paquete instalable es `@rsvp/contracts` y se publica en GitHub Packages únicamente desde una etiqueta `contracts-v*`.

La verificación efectiva de Pact necesita configurar la variable de repositorio `PACT_BROKER_BASE_URL` y el token correspondiente. El workflow falla de forma explícita hasta que exista ese recurso externo: no simula una verificación de proveedor.

La publicación debe ejecutarse desde una etiqueta con versión semántica, por
ejemplo `contracts-v1.2.3`; el workflow publica exclusivamente el workspace
`@rsvp/contracts`, nunca la raíz privada del monorepo. Los builds de imágenes
requieren un Dockerfile por servicio; no se deben activar como publicación a un
registry hasta que los propietarios de cada servicio los entreguen.


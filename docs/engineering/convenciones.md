# Convenciones obligatorias de código · Backend

## Descubrimiento y entregas (obligatorio)

Antes de editar código o contrato, consulta CodeGraph 1.6.2 para flujo e impacto y confirma rutas en archivos actuales. Planifica el cambio como slice vertical observable, con REQ, caso negativo y prueba por corte. Las listas por capas de los carriles son inventario, no orden de entrega. Usa la [revisión de 2026-10-16](../plan/revision-vertical-slice-2026-10-16.md). Graphify queda sustituido por CodeGraph.


Estas reglas aplican a código nuevo o modificado. La ficha del carril añade criterios de aceptación específicos. Si una regla no corresponde a un componente, registra `N/A` con motivo en la evidencia del carril; no la marques como probada.

## Fuente de verdad y cambios

1. Consulta la implementación, el contrato versionado y la ficha pertinente antes de cambiar comportamiento. Separa lo observado de lo planeado. No inventes rutas, estados, columnas ni eventos para satisfacer una ficha.
2. Mantén un cambio por intención y agrega pruebas de comportamiento para defectos o reglas nuevas. Una prueba verde previa no demuestra funcionalidad que no ejercita.
3. Al cambiar un contrato, actualiza su especificación y el consumidor afectado, describe compatibilidad y versión, y ejecuta la validación del contrato. El frontend es otro repositorio: coordina el cambio de paquete publicado, sin asumir que un tipo local ya llegó allí.

## Arquitectura y datos

4. `domain/` contiene reglas de negocio sin imports de NestJS, Spring, Django, Prisma, transporte ni almacenamiento. `application/` orquesta casos de uso mediante puertos; adaptadores e interfaces traducen HTTP, eventos y persistencia. Evita ciclos entre capas y servicios.
5. Cada servicio posee su esquema y sus migraciones. Prohíbe consultas directas a tablas de otro servicio. Para un cambio persistente, versiona la migración y documenta estrategia de despliegue y reversión; no borres datos para hacer pasar una prueba.
6. Usa identificadores de tenant explícitos en consultas y comandos que manejan celebraciones. Verifica autorización en el servicio y agrega pruebas de acceso cruzado para endpoints y consultas nuevas. La existencia de RLS no sustituye pruebas de política y contexto.
7. Define fechas como instantes UTC en almacenamiento e intercambio; conserva el identificador IANA de zona horaria para reglas y presentación. La moneda viaja con el monto y se calcula sin `float` binario.

## APIs, eventos y fallos

8. Valida entradas en el borde y devuelve errores estables según OpenAPI. No expongas detalles internos, identificadores ajenos ni PII en respuestas de error.
9. Declara eventos en AsyncAPI antes de producirlos. En cambios persistentes, escribe agregado y outbox en una transacción. El consumidor deduplica por ID de evento y demuestra idempotencia con entrega repetida. Versiona cambios incompatibles de esquema y define su convivencia.
10. Usa `correlationId` de extremo a extremo. Registra contexto útil sin secretos, tokens, contenido privado ni datos personales innecesarios. Define tiempo de espera y manejo de reintentos en integraciones externas; evita reintentos no acotados.

## Estilo y verificación

11. TypeScript permanece en modo `strict`; usa tipos del contrato y modelos de dominio explícitos. Evita `any` y aserciones de tipo que oculten entradas no validadas. Python y Java siguen los formateadores y analizadores configurados para su workspace; no atribuyas un gate que aún no está configurado.
12. Ejecuta el build, typecheck, lint y pruebas que existan para el workspace afectado, más `corepack yarn contracts:validate` cuando toques contratos. Para cambios de outbox, tenancy o concurrencia, añade la prueba de integración correspondiente cuando haya entorno disponible. Anota comando, resultado y límite de la prueba.
13. `DONE` exige requisitos demostrados, regresión relevante y evidencia reproducible. Un bloqueo externo queda `BLOCKED-EXTERNAL`; `PARTIAL`, un mock o un check scaffold no equivalen a `PASS`.

## Aplicación real

`.editorconfig` fija formato básico. CI ejecuta las verificaciones configuradas; algunas tareas llamadas `lint` hacen solo typecheck y algunos workspaces conservan scaffolds. La revisión del PR debe comprobar los puntos que aún carecen de gate automático. Para impedir merge con checks rojos, un administrador debe proteger `dev` y `main`: PR obligatorio, una aprobación de otro eje, conversaciones resueltas, checks de CI y Gitleaks requeridos, sin bypass ni force push. Primero confirma los nombres exactos de los checks en un PR ejecutado. Un archivo del repositorio no activa esa protección por sí solo.

Referencias normativas y de método: [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.2.html), [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/latest), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) y [protección de ramas de GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches). Las reglas de dominio anteriores proceden del [plan de RSVP](../plan/README.md) y de [ADR-001](../architecture/ADR-001-contract-freeze.md).

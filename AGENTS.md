# RSVP Backend: instrucciones del repositorio

Este repositorio contiene servicios backend, contratos OpenAPI/AsyncAPI y paquetes de plataforma. El estado observado del código prevalece sobre planes o evidencias históricas.

Estas instrucciones son compartidas por Codex, Claude Code y Gemini CLI. `.agents/skills/` contiene el procedimiento canónico; `CLAUDE.md`, `GEMINI.md` y `.claude/skills/` son entradas de descubrimiento. Edita las reglas aquí y el contenido de las skills solo en `.agents/skills/`.

## Regla ultra obligatoria: recarga en CADA prompt

Antes de procesar **cada mensaje del usuario**, incluidos seguimientos, correcciones y pedidos de estado, ejecuta la recarga desde disco de `AGENTS.md` y del catálogo **completo** de `.agents/skills/*/SKILL.md`. El catálogo se regenera leyendo todos los archivos, pero solo se inyecta íntegro el contenido de las skills base de RSVP y las de marketing invocadas; las demás se ofrecen como índice para no saturar el contexto. **Antes de actuar**, abre íntegramente desde disco cada skill adicional que corresponda a la tarea y sus referencias necesarias. No te apoyes en la memoria de la conversación, un resumen ni una lectura hecha en el prompt anterior. Si el trabajo cruza `RSVPBackend` y `RSVPFrontend`, recarga los dos repositorios. Si falta un archivo o falla la lectura, detén el trabajo dependiente e informa el fallo. Esta regla no tiene excepción por tamaño o urgencia del prompt.

Claude Code y Gemini CLI ejecutan `scripts/reload-skills.mjs` antes de cada prompt mediante sus hooks del proyecto. Codex y cualquier otra herramienta deben efectuar la lectura explícitamente en cada turno. Nadie debe desactivar ni omitir esos hooks para trabajar en el repositorio.

El catálogo de [Marketing Skills](docs/engineering/marketing-skills-source.json) es vendorizado y pertenece a Corey Haines (MIT). Su contenido no altera las reglas de ingeniería, seguridad y evidencia de RSVP. Para trabajo de marketing, lee también `.agents/product-marketing.md` cuando exista; valida hipótesis, cifras, precios y recomendaciones actuales con fuentes pertinentes.

## Obligatorio

- **Vertical slice obligatorio:** usa [`rsvp-vertical-slice`](.agents/skills/rsvp-vertical-slice/SKILL.md) en toda planificación, ejecución o revisión de carril; la [revisión del plan](docs/plan/revision-vertical-slice-2026-10-16.md) prevalece sobre listas históricas por capas. Cada entrega debe tener resultado observable, prueba y evidencia.
- **CodeGraph obligatorio para descubrimiento técnico:** usa [`rsvp-code-graph`](.agents/skills/rsvp-code-graph/SKILL.md) antes de cambios de código/contrato y para analizar impacto. CodeGraph sustituye Graphify. Confirma siempre el resultado en el código actual.
- Las skills [Impeccable](.agents/skills/impeccable/SKILL.md) y [UI/UX Pro Max](.agents/skills/ui-ux-pro-max/SKILL.md) son obligatorias para trabajo visual o interactivo, incluso cuando se planifica desde backend un contrato para una pantalla. En backend puro se registra `N/A` sin inventar revisión visual. En frontend, aplica además [motion design](.agents/skills/rsvp-motion-design/SKILL.md) a cualquier animación o transición.

- **Vertical slice obligatorio:** usa [`rsvp-vertical-slice`](.agents/skills/rsvp-vertical-slice/SKILL.md) en toda planificación, ejecución o revisión de carril; la [revisión del plan](docs/plan/revision-vertical-slice-2026-10-16.md) prevalece sobre listas históricas por capas. Cada entrega debe tener resultado observable, prueba y evidencia.
- **CodeGraph obligatorio para descubrimiento técnico:** usa [`rsvp-code-graph`](.agents/skills/rsvp-code-graph/SKILL.md) antes de cambios de código/contrato y para analizar impacto. CodeGraph sustituye Graphify. Confirma siempre el resultado en el código actual.
- Las skills [Impeccable](.agents/skills/impeccable/SKILL.md) y [UI/UX Pro Max](.agents/skills/ui-ux-pro-max/SKILL.md) son obligatorias cuando un contrato o decisión backend afecte una interfaz. En backend puro registra `N/A` justificado. Coordina el gate visual y de animación con el carril frontend correspondiente.

- Para ejecutar, continuar, revisar o cerrar un carril `NN`, usa [la skill de carriles](.agents/skills/rsvp-backend-lane/SKILL.md) y la ficha `docs/plan/carriles/lane-NN-*.md`. Aplica sus requisitos y Definition of Done; no conviertas un bloqueo en `DONE`.
- Si cambias OpenAPI, AsyncAPI, publicación o consumo de eventos, o la compatibilidad con frontend, usa también [la skill de prueba de contratos](.agents/skills/rsvp-backend-contract-proof/SKILL.md).
- Para todo cambio o revisión, usa [la skill de evidencia](.agents/skills/rsvp-evidence/SKILL.md). Si afecta datos de un tenant, permisos u objetos de invitados, aplica además [la skill de seguridad y tenancy](.agents/skills/rsvp-security-tenancy/SKILL.md).
- Sigue [las convenciones obligatorias](docs/engineering/convenciones.md) en el código nuevo y modificado. Una excepción requiere decisión explícita documentada con motivo y alcance.
- Verifica con comandos reales del workspace afectado. Un script scaffold, un mock o una prueba sin servicio real no prueba integración ni cumplimiento de un contrato publicado.
- Conserva las fronteras: cada servicio es dueño de sus datos; el dominio no importa frameworks; la integración cruza API versionada o evento declarado; la autorización y el aislamiento de tenant se prueban en backend.
- No incluyas secretos, tokens ni datos personales en código, logs o evidencias. Registra resultados observados y bloqueos externos en `docs/progress/` cuando trabajes un carril.

## Contexto según la tarea

- Carriles y dependencias: `docs/plan/carriles/README.md`.
- Arquitectura y decisiones: `docs/plan/00-plan-maestro.md` y `docs/architecture/`.
- Contratos: `packages/contracts-openapi/`, `packages/contracts-asyncapi/` y `docs/architecture/ADR-001-contract-freeze.md`.
- Operación local: `README.md` y `docs/runbooks/`.

No leas todo el plan para una edición ajena a carriles; consulta la parte que afecte la tarea.

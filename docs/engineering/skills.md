# Skills compartidas de RSVP

Este estándar viaja con **ambos repositorios** y sirve a los dos programadores de Claude Code, los dos de Codex y la persona que usa Gemini CLI. `AGENTS.md` manda; las skills canónicas están en `.agents/skills/`. Los adaptadores de `.claude/skills/` se generan desde allí. `CLAUDE.md` y `GEMINI.md` importan `AGENTS.md`.

## Regla de cada prompt

En **cada** mensaje del usuario se regenera el catálogo leyendo todos los `SKILL.md` desde disco. Los hooks `UserPromptSubmit` de Claude y `BeforeAgent` de Gemini lo inyectan antes de que el agente actúe. Para Codex, ejecuta `node scripts/reload-skills.mjs cli` en cada turno y lee completas las skills pertinentes que el catálogo señale. En una tarea que cruza repositorios, hazlo en ambos. Esta obligación también vale para seguimientos y correcciones.

El catálogo de marketing tiene 50 skills y 786 KB solo en archivos principales. Para mantener una conversación utilizable, el hook entrega un índice actualizado de las 50, el texto completo de las skills RSVP, `marketing-ideas`, `product-marketing` y las skills invocadas por nombre (`$skill` o `/skill`). **Antes de aplicar otra skill del índice, abre su `SKILL.md` entero y las referencias que necesites.** Una descripción abreviada no sustituye el procedimiento. Si la recarga falla, no continúes trabajo dependiente de ella.

## Extensión obligatoria de 2026-10-16

Para cualquier carril, aplica `rsvp-vertical-slice` y `rsvp-code-graph` además de la skill de carril y evidencia. CodeGraph 1.6.2 se ejecuta desde el repo (`corepack yarn graph:init`, `graph:status`, `graph:sync`) y tiene MCP de proyecto para Claude, Codex y Gemini. Su índice local está fuera de Git. Si un contrato afecta interfaz, lee Impeccable y UI/UX Pro Max desde `.agents/skills/` y coordina animación con el frontend. Las fuentes, revisiones, licencias y adaptaciones figuran en [skill-sources-2026-10-16.json](skill-sources-2026-10-16.json).

## Elección según la tarea

| Trabajo | Skills principales |
|---|---|
| Cualquier carril o cambio de código | `rsvp-vertical-slice`, `rsvp-code-graph`, `rsvp-evidence` |
| Carril backend | `rsvp-backend-lane`, `rsvp-evidence` |
| Contrato que afecta interfaz | `impeccable`, `ui-ux-pro-max` y carril frontend vinculado |
| Contrato API o evento | `rsvp-backend-contract-proof`, `rsvp-evidence` |
| Datos privados, autorización o tenancy | `rsvp-security-tenancy`, `rsvp-evidence` |
| Sitio público y conversión | `copywriting`, `cro`, `seo-audit`, `schema` según alcance |
| Estrategia o campañas | `marketing-ideas`, `marketing-plan`, `content-strategy` según pedido |
| Imagen o video promocional | `image`, `video`, `ad-creative` según formato |

Las skills de marketing guían análisis y producción; no autorizan publicar campañas, contactar personas ni gastar presupuesto. Para trabajo comercial, consulta `.agents/product-marketing.md`, valida datos actuales y separa hipótesis de hechos. Las reglas de seguridad, contratos y evidencia de RSVP prevalecen ante cualquier consejo genérico del catálogo.

## Procedencia y mantenimiento

- Las 50 skills vendorizadas vienen de [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills), revisión fijada en [marketing-skills-source.json](marketing-skills-source.json), bajo [licencia MIT](marketingskills-LICENSE).
- `rsvp-evidence`, `rsvp-security-tenancy` y el enfoque de ruteo fueron adaptados de ideas de [AtlasPromptManager](https://github.com/PabloArauzCaballero/AtlasPromptManager). Son procedimientos originales ajustados al código y los carriles de RSVP, no copias de sus instrucciones propias de Atlas.
- Para actualizar el catálogo externo, revisa la nueva revisión y licencia, reemplaza **solo** los directorios listados en el manifiesto en ambos repositorios, actualiza el commit y nombres del manifiesto, calcula `fileCount` y `contentSha256` con `node scripts/validate-marketing-vendor.mjs --print`, ejecuta `node scripts/sync-claude-skill-adapters.mjs` y `corepack yarn harness:validate`. Revisa el diff antes de aprobar.
- Para editar una skill propia de RSVP, cambia su `SKILL.md` canónico en ambos repos cuando sea compartida, regenera adaptadores y ejecuta la validación. No edites los adaptadores a mano.

Los hooks del proyecto son comprobados por `harness:validate`. Claude Code necesita una versión que soporte `onFailure: "block"`; Gemini CLI puede pedir confianza inicial para hooks del proyecto. Codex no ofrece aquí un hook equivalente por prompt, por lo que su recarga depende de la instrucción obligatoria de `AGENTS.md` y el comando anterior.

---
name: rsvp-code-graph
description: Usa CodeGraph local para explorar flujos, símbolos e impacto antes de cambios de código en ambos repos; confirma siempre el resultado en archivos actuales.
---

# CodeGraph RSVP

Obligatoria para cambios de código, contratos y planificación técnica de carriles. Sustituye Graphify. El paquete `@colbymchenry/codegraph@1.6.2` está fijado por repo.

1. Desde la raíz, ejecuta `corepack yarn codegraph status`. Si no hay índice, ejecuta `corepack yarn codegraph init --yes`; si está atrasado, `corepack yarn codegraph sync`. El índice local vive en `.codegraph/` y no se versiona.
2. Formula una pregunta sobre el flujo o símbolo con `corepack yarn codegraph explore "<pregunta concreta>"`. Si la tarea cruza repos, consulta cada índice por separado y verifica el contrato entre ambos. Si el MCP `codegraph_explore` está conectado, puede usarse en su lugar.
3. Contrasta las rutas y líneas sugeridas con el código actual, especialmente después de editar. Usa `rg` o lectura directa para archivos nuevos, configuración, texto y resultados no cubiertos por el grafo. No conviertas un resultado vacío o desactualizado en evidencia de ausencia.
4. Antes de editar símbolos compartidos, revisa callers/impact y pruebas afectadas. Tras editar, sincroniza y ejecuta pruebas dirigidas. Anota versión, consulta y límite del índice en la evidencia si influye en una decisión.

La integración MCP está en `.mcp.json` (Claude), `.gemini/settings.json` (Gemini) y `.codex/config.toml` (Codex en proyecto confiable). La CLI funciona aunque el cliente no cargue MCP.

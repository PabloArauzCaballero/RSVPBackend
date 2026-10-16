# Validación de la replanificación · Backend · 2026-10-16

| Comando / inspección | Resultado observado | Alcance |
|---|---|---|
| `corepack yarn graph:init` y `corepack yarn graph:status` | CodeGraph 1.6.2 indexó 119 archivos; estado actualizado tras `graph:sync` | Índice local de código, fuera de Git |
| `corepack yarn graph:probe` | Respuesta MCP `initialize OK` de CodeGraph 1.6.2 | Transporte stdio de la configuración de proyecto, probado en Windows |
| `corepack yarn harness:validate` | 36 carriles y 58 skills válidos; recarga de Claude/Gemini y revisión por slices verificadas | Reglas y estructura; no acredita uso humano del flujo |
| `git diff --check` | Código de salida 0 | Cambios tracked, sin errores de espacios |

Las configuraciones MCP de Claude, Codex y Gemini apuntan al mismo paquete local. La prueba de transporte ejecutó el comando de `.mcp.json`; no se inició una sesión interactiva de esos tres clientes. No se modificó comportamiento de producto ni se ejecutaron pruebas visuales. Las fechas del calendario requieren reestimación tras medir slices completos.

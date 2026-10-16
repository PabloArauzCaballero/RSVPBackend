---
name: rsvp-evidence
description: Relaciona cada afirmación sobre un cambio RSVP con comandos, pruebas y artefactos observados, sin cerrar requisitos incompletos.
---

# Evidencia y verificación

Usa esta skill en cualquier cambio o revisión, aunque no tenga número de carril. Adaptada al esquema de requisitos y evidencia de RSVP, con ideas de `evidence-and-verification` y `requirements-and-acceptance` de AtlasPromptManager.

1. Define el resultado observable y los REQs afectados antes de editar. Comprueba el comportamiento existente en código y runtime cuando esté disponible; una ficha o un test antiguo no acreditan el estado actual.
2. Para cada REQ, anota prueba positiva, caso negativo o límite pertinente, y dependencia externa. Mantén la relación `REQ → cambio → comando/artefacto → resultado` en la evidencia del carril o del PR.
3. Distingue `WRITTEN` (diff), `RUNS` (build/typecheck), `TESTED` (prueba dirigida), `VERIFIED` (flujo real pertinente) y `DONE` (todos los REQs y gates de la ficha). Afirma solo el nivel alcanzado. Un test con mocks acredita la capa que ejercita, no integración real.
4. Registra comando, código de salida, fecha, superficie y límite de la prueba. Si un cambio posterior toca la zona probada, repite la verificación afectada. Identifica fallos preexistentes con evidencia separada.
5. Declara explícitamente lo no cubierto y los bloqueos externos. `BLOCKED-EXTERNAL`, `PARTIAL` y `N/A` no se convierten en `PASS` sin observación.

No debilites aserciones ni elimines pruebas para declarar cierre. Si la tarea toca un carril, sigue el formato de evidencia de su skill específica.

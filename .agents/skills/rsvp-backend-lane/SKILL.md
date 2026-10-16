---
name: rsvp-backend-lane
description: Ejecuta, continúa o revisa un carril NN del plan backend de RSVP con requisitos y evidencia verificables.
---

# Carril backend

Usa esta skill cuando el trabajo se identifique por un carril `NN`, o cuando se pida cerrarlo o verificar su estado. La ficha `docs/plan/carriles/lane-NN-*.md` define el alcance; `AGENTS.md` y `docs/engineering/convenciones.md` definen reglas comunes.

1. Lee la revisión `docs/plan/revision-vertical-slice-2026-10-16.md`, aplica `rsvp-vertical-slice` y consulta `rsvp-code-graph` para el flujo e impacto. El inventario histórico por componentes no fija la secuencia.
2. Localiza la ficha y lee objetivo, REQs, predecesores, riesgos y Definition of Done. Inspecciona código, contratos, migraciones y pruebas relevantes; contrasta el estado de la ficha con el observado. Si el trabajo cruza al frontend, consulta el contrato publicado y la ficha `FNN` relacionada cuando exista.
3. Para cada REQ, identifica una prueba o verificación observable y la dependencia que exige. Trata la lista de archivos y los slices de la ficha como plan, no como prueba de que esos archivos o comportamientos existan.
4. Implementa el cambio dentro del dominio dueño. Verifica comportamiento dirigido después de cada unidad coherente; ante un fallo causado por el cambio, corrige y repite la verificación. Aplica [la skill de contratos](../rsvp-backend-contract-proof/SKILL.md) si cambian APIs o eventos.
5. Antes de cerrar, ejecuta regresión relevante, comprueba migraciones, aislamiento de tenant, autorización y observabilidad cuando corresponda; aplica [seguridad y tenancy](../rsvp-security-tenancy/SKILL.md) si tocas esos límites. Distingue unidad, integración, contrato, runtime y dispositivo externo; cada nivel requiere evidencia propia.
6. Deja en `docs/progress/evidence/lane-NN/` una tabla por REQ con `PASS`, `FAIL`, `BLOCKED-EXTERNAL` o `N/A` justificado, comando o artefacto, resultado y fecha. Actualiza `STATUS_LOG.md`, `BLOCKERS.md` y `DECISIONS.md` solo si el trabajo altera su contenido. Un `BLOCKED-EXTERNAL` documenta el bloqueo pero no satisface `DONE`.
7. Declara `DONE` solo si todos los REQs aplicables son `PASS`, los gates relevantes pasaron y hubo regresión verificada. Si faltó infraestructura, revisión humana o publicación, informa el estado alcanzado y el paso exacto pendiente sin afirmar cierre.

No requieras leer todos los carriles ni ejecutar toda la suite para un cambio aislado. No confundas un script scaffold o un fake driver con prueba de integración real.

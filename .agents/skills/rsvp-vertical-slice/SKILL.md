---
name: rsvp-vertical-slice
description: Replanifica y ejecuta un carril RSVP como entregas observables que cruzan solo las capas necesarias y cierran cada requisito con evidencia.
---

# Vertical slice RSVP

Obligatoria al planificar, ejecutar o revisar cualquier carril de ambos repos. Adaptada de vertical-slicing de AtlasPromptManager. Consulta también `docs/plan/revision-vertical-slice-2026-10-16.md`.

1. Lee REQs, dependencias y código actual; usa CodeGraph para descubrir ruta de llamadas e impacto antes de cambiar símbolos, y confirma archivos en disco. No tomes el índice como fuente de verdad cuando esté desactualizado.
2. Define cada slice por un comportamiento observable, no por una capa, archivo, pantalla aislada o suite final. Incluye contrato/datos, lógica, interfaz e integración solo cuando el comportamiento los requiere. Para infraestructura, el flujo observable puede ser un comando, evento, petición o artefacto de CI.
3. Para cada slice escribe: REQs cubiertos, entrada, resultado visible, capas/repos tocados, caso negativo, prueba y dependencia externa. Mantén el corte pequeño; ordena primero la incertidumbre técnica o contractual y respeta predecesores.
4. Si el slice cruza repos, versiona y verifica el contrato del backend y el consumo frontend en la misma entrega coordinada; un mock no acredita integración. Cada dueño conserva su repo y las PR se vinculan.
5. Cierra la prueba y evidencia de cada slice antes de pasar al siguiente. Un slice sin runtime o revisión de plataforma queda en el nivel de evidencia realmente alcanzado. No declares el carril DONE por haber completado solo el primer slice.

Las listas antiguas por componentes son inventario de trabajo, no secuencia autorizada. La replanificación de 2026-10-16 fija el primer corte de cada carril; descompón los REQs restantes con el mismo criterio antes de implementarlos.

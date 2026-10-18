# Carril 10 · Dominio de Celebration y tenancy

| REQ | Estado | Prueba |
|---|---|---|
| REQ-10-01 dominio sin framework | PASS | `architecture.test.mjs` · "domain/ imports nothing but domain/" (y la prueba de que el chequeo puede fallar) |
| REQ-10-02 slug único e inmutable | PASS | `domain.test.mjs` REQ-10-02 · `http.test.mjs` REQ-13-06 · índice único `celebration_slug_key` en Postgres |
| REQ-10-03 transiciones explícitas, prohibidas → 409 | PASS | `domain.test.mjs` REQ-10-03 · `http.test.mjs` REQ-13 (archivado → 409) |
| REQ-10-04 lock optimista | PASS | `http.test.mjs` y `postgres.integration` "two concurrent writes… ten times in a row": siempre un 200 y un 409 |
| REQ-10-05 planner ve su organización y ninguna otra | PASS | `http.test.mjs` REQ-10-05 |
| REQ-10-06 ajeno → 404 en todos los endpoints | PASS | `http.test.mjs` recorre los 13 endpoints con un extraño; `postgres.integration` prueba RLS con SQL directo |

DoD específico:
- Ningún repositorio acepta una consulta sin `celebrationId`: `CelebrationRepository.findById(scope, celebrationId)`; la lista exige el scope del actor.
- RLS activa **y forzada** en todas las tablas: `architecture.test.mjs` (estático) y `postgres.integration` (catálogo `pg_class`); el rol dueño no lee nada sin scope.
- Migración versionada y reversible: `0001` y `0002` con su `.down.sql`, probadas arriba, abajo y arriba otra vez.

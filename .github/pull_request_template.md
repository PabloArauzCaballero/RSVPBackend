## Carril y alcance

- Carril `NN` o motivo de cambio fuera de carril:
- REQs afectados y contrato/versiones afectados:

## Evidencia obligatoria

- [ ] Apliqué `AGENTS.md`, `$rsvp-backend-lane` y `docs/engineering/convenciones.md` al carril.
- [ ] Apliqué `$rsvp-backend-contract-proof` si cambié API, eventos o consumidores; documenté compatibilidad.
- [ ] Recargué el catálogo en cada prompt y apliqué `$rsvp-evidence`; usé `$rsvp-security-tenancy` cuando hubo datos privados, permisos o tenancy.
- [ ] Registré por REQ `PASS`, `FAIL` o `BLOCKED-EXTERNAL`, con comando/artefacto y resultado observado.
- [ ] Ejecuté verificaciones del workspace afectado, regresión pertinente y pruebas de tenant/autorización cuando aplican.
- [ ] Separé pruebas con mocks/scaffolds de pruebas con infraestructura real.
- [ ] Actualicé contratos, migraciones, runbooks y registros de progreso si el cambio lo requiere.

Comandos ejecutados y resultados:

Bloqueos y verificación pendiente:

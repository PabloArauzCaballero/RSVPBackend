# Evidencia local — carriles 25–36 (Fabio)

Fecha: 2026-10-11.

## Ejecutado

```text
corepack yarn workspace @rsvp/gift-list-service test
# 4/4 tests passed

corepack yarn workspace @rsvp/provider-catalog-service test
# 6/6 tests passed
```

La suite cubre dinero en unidades menores, fuente catalogada/externa, máquina de
estados y modo seguro `RESTRICTED`, compare-and-set con 20 contendientes, estados
de proveedor y visibilidad pública, catálogo/geo Bolivia, redirección **302** con
UTM y `correlationId`, dedupe/bot, ranking, capacidad de booking, expiración,
cotización y replay determinista de métricas.

## Límites honestos

- Los tests de 20 contendientes verifican compare-and-set del adaptador
  determinista; no reemplazan la prueba requerida contra PostgreSQL/Testcontainers.
- Hay migraciones y contratos, pero endpoints Nest/Prisma, relay real de outbox y
  Pact requieren servicios externos ejecutables y el Pact Broker configurado.

Estado: `IMPLEMENTED_WITH_EXTERNAL_BLOCKER`, no `DONE` ni `REGRESSION_VERIFIED`.

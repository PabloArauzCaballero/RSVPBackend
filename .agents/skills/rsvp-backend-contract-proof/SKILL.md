---
name: rsvp-backend-contract-proof
description: Verifica cambios de OpenAPI, AsyncAPI, eventos o compatibilidad backend de RSVP con consumidores.
---

# Prueba de contratos backend

Usa esta skill cuando se añada o cambie una API, evento, productor, consumidor o paquete de contratos, y al revisar su compatibilidad. Los contratos viven en `packages/contracts-openapi/` y `packages/contracts-asyncapi/`; `docs/architecture/ADR-001-contract-freeze.md` fija el versionado.

1. Identifica especificación anterior, nueva y consumidores conocidos. Anota el cambio exacto de rutas, schema, estado, cabecera o evento; distingue adición compatible de ruptura. No atribuyas compatibilidad por inspección visual solamente.
2. Actualiza la fuente contractual y el código o test afectado en el mismo cambio. Para eventos, comprueba sobre, versionado, outbox y deduplicación del consumidor. Para endpoints con tenant, comprueba 401/403 y acceso cruzado según el caso.
3. Ejecuta `corepack yarn contracts:validate` y pruebas dirigidas del productor y consumidor disponibles. Si Pact, un servicio real o el paquete publicado son necesarios, registra por separado su resultado o el bloqueo exacto. Un validator local no prueba Pact publicado ni integración extremo a extremo.
4. Deja evidencia de versión, compatibilidad, comandos y resultados en el carril o PR. Si cambia el contrato consumido por frontend, señala la versión que debe adoptar `RSVPFrontend` y verifica allí cuando la tarea abarque ambos repositorios.

No publiques paquetes ni alteres infraestructura externa solo por invocar esta skill; hazlo cuando la tarea lo autorice y el flujo de release esté preparado.

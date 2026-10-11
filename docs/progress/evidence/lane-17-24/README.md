# Evidencia de carriles 17–24 (Miguel)

## Implementado y probado localmente

- 17: agregados de invitados/grupos, CSV parcial y fallback de locale.
- 18: token opaco de 256 bits, SHA-256 persistible, revocación, redacción y errores anti-enumeración.
- 19–21: RSVP con reloj inyectable, política de acompañantes, proyecciones idempotentes y replay.
- 22: consentimiento, anonimización irreversible y evento de borrado. Los consumidores reales de Gift List quedan fuera de este carril de código porque pertenecen a su propietario; el contrato de evento ya está emitido.
- 23: puerto único de notificación, adaptadores sin SDK, i18n, quiet hours y deduplicación.
- 24: tokens Expo, lotes de 100, baja por `DeviceNotRegistered`, reintentos y driver falso.

## Bloqueo externo honesto

`REQ-24-06` requiere credenciales Apple/Google/Expo, una compilación firmada y dos dispositivos físicos. No se declara completado por pruebas simuladas. Recopilar capturas de iOS y Android antes de cerrar el carril 24.

## Operación

Las migraciones contienen el plan de reversión en comentarios. La retención por celebración debe ser suministrada por Celebration Settings; mientras ese evento no esté disponible el comportamiento seguro es no borrar automáticamente por tiempo.

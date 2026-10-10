# ADR-001: Contratos versionados antes de la lógica de negocio

## Estado

Aceptado — Fase 0.

## Contexto

Los siete servicios se desarrollarán en paralelo y ningún servicio comparte base de datos. La planificación exige que el acoplamiento entre ejes ocurra únicamente mediante APIs públicas y eventos.

## Decisión

Las especificaciones OpenAPI 3.1 por servicio y el único catálogo AsyncAPI se versionan como `v1.0.0` antes de implementar casos de uso. Todo cambio posterior requiere una versión nueva, compatibilidad documentada y publicación de Pact.

## Consecuencias

- Los equipos pueden generar stubs y tipos sin esperar una implementación.
- El contrato es una interfaz de producto revisable, no un efecto del código.
- La evolución requiere disciplina de versionado, pero evita cambios silenciosos entre ejes.


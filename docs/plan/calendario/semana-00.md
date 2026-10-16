> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Semana 00 · Contract Freeze

**12 de octubre al 16 de octubre de 2026**

La única semana en que los cuatro trabajan sobre lo mismo. Al final de esta semana los contratos quedan congelados y nadie vuelve a esperar a nadie.

> **H1 · Contratos congelados** — viernes 16 de octubre

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | Esqueleto del monorepo + infraestructura local |
| [**Leo**](../equipo/leo.md) | Contrato de `Celebration` y `EventTypeDefinition` |
| [**Miguel**](../equipo/miguel.md) | Contrato de RSVP y catálogo de eventos a notificar |
| [**Fabio**](../equipo/fabio.md) | Contrato de `Lead`, listings y productos catalogados |

---

## Día a día

### Lunes 12 de octubre

Apertura del proyecto. Lectura conjunta del plan maestro completo, incluido el modelo de negocio. Se acuerda el sobre de evento estándar y la convención de routing keys. Cada uno se lleva su bloque del catálogo AsyncAPI.

### Martes 13 de octubre

Cada eje escribe los eventos de su dominio en `packages/contracts-asyncapi`: nombre, versión, payload y ejemplo. Pablo arranca el esqueleto de Turborepo y el `docker-compose.yml`.

### Miércoles 14 de octubre

Cada eje escribe su OpenAPI 3.1: endpoints, parámetros y códigos de error. Revisión cruzada: cada uno lee el contrato del que consume. Los desacuerdos se resuelven hoy, no en diciembre.

### Jueves 15 de octubre

ERD por servicio y matriz de permisos por rol. Pablo deja `docker compose up` levantando Postgres×7, RabbitMQ, Redis, MinIO, Kong y el stack OTel. Se monta el harness `.claude/` y las fichas de carril.

### Viernes 16 de octubre

**Congelamiento.** Los 8 OpenAPI y el catálogo AsyncAPI quedan firmados por los cuatro y etiquetados `v1.0.0`. Se publica `@rsvp/contracts`. Desde el lunes, cambiar un contrato es una versión nueva y un aviso explícito.

---

## Atención esta semana

- Si un contrato queda ambiguo esta semana, se paga en diciembre multiplicado por cuatro. Es mejor discutir de más ahora.
- Nadie escribe lógica de negocio esta semana. La tentación de ir adelantando rompe el propósito del freeze.

---

[Calendario](README.md) · [Semana 01 →](semana-01.md)

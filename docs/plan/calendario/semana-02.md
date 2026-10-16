> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Semana 02 · Entrega garantizada de eventos

**26 de octubre al 30 de octubre de 2026**

La semana más crítica del backend. El outbox es el corazón del sistema: si tiene un bug sutil, los siete servicios lo heredan.

> **H2 · Primer evento extremo a extremo** — viernes 30 de octubre

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | Carriles **03** y **04** — mensajería RabbitMQ y outbox/inbox |
| [**Leo**](../equipo/leo.md) | Carriles **11** y **12** — multi-evento y los 4 switches |
| [**Miguel**](../equipo/miguel.md) | Carriles **18** y **19** — tokens de invitado y RSVP |
| [**Fabio**](../equipo/fabio.md) | Carril **26** — concurrencia de reserva de regalo |

---

## Día a día

### Lunes 26 de octubre

Apertura. Leo avisa a Miguel y Fabio la forma exacta del payload de `CelebrationSettingsUpdated.v1`, que ambos consumen.

### Martes 27 de octubre

Pablo: topología declarativa y publisher con confirms. Fabio: lock optimista contra Postgres real, nada de mocks.

### Miércoles 28 de octubre

Pablo: outbox dentro de la transacción del agregado. Miguel: RSVP con reloj fijo, sin `sleep` en ningún test.

### Jueves 29 de octubre

Revisión cruzada a las 16:00. Pablo demuestra el test de matar el proceso entre commit y publish.

### Viernes 30 de octubre

**Hito H2**: un comando escribe en outbox, el relay publica, un consumidor lo procesa y la traza aparece en Tempo. Fabio demuestra 20 concurrentes con un solo ganador, repetido 10 veces.

---

## Atención esta semana

- El test de concurrencia de Fabio tiene que correr contra Postgres real. Con un mock de repositorio no prueba absolutamente nada.
- Leo entrega los switches esta semana o bloquea el carril 20 de Miguel y el 27 de Fabio la semana que viene.

---

[← Semana 01](semana-01.md) · [Calendario](README.md) · [Semana 03 →](semana-03.md)

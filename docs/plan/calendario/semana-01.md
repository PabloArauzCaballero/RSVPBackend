> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Semana 01 · Arranque de los cuatro ejes

**19 de octubre al 23 de octubre de 2026**

Primera semana de código. Pablo entrega la base sobre la que corren los otros tres; mientras tanto, ellos escriben dominio puro y tests unitarios, que no necesitan infraestructura.

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | Carriles **01** y **02** — monorepo poliglota e infraestructura local |
| [**Leo**](../equipo/leo.md) | Carril **10** — dominio de `Celebration` y tenancy |
| [**Miguel**](../equipo/miguel.md) | Carril **17** — dominio de `Guest` y `GuestGroup` |
| [**Fabio**](../equipo/fabio.md) | Carril **25** — dominio de `GiftList` y su máquina de estados |

---

## Día a día

### Lunes 19 de octubre

Apertura. Cada uno lee su ficha de carril completa, riesgos y preguntas abiertas incluidas. Discovery factual antes de tocar nada.

### Martes 20 de octubre

Primer slice vertical. Los tres ejes de dominio escriben agregados y value objects sin ninguna dependencia de framework.

### Miércoles 21 de octubre

Segundo slice. Tests unitarios de invariantes. Pablo deja `yarn turbo run build lint test` verde en los 8 workspaces.

### Jueves 22 de octubre

Tercer slice y revisión cruzada a las 16:00. Pablo deja el `docker compose up` operativo para los demás.

### Viernes 23 de octubre

QA dirigido y cierre. El test arquitectónico de «el dominio no importa framework» tiene que estar verde en los tres ejes.

---

## Atención esta semana

- Si Pablo no entrega la infraestructura el viernes, los otros tres siguen con dominio puro una semana más sin bloquearse. Es el único colchón natural del proyecto.

---

[← Semana 00](semana-00.md) · [Calendario](README.md) · [Semana 02 →](semana-02.md)

> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Semana 06 · Plataforma de frontend y push

**23 de noviembre al 27 de noviembre de 2026**

Pablo cambia de repo y monta el Turborepo de frontend. Miguel enfrenta la exigencia dura del cliente: push real en los dos sistemas operativos.

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | **F01**, **F02** y **F03** — Turborepo de front, design tokens y primitivas de UI |
| [**Leo**](../equipo/leo.md) | Buffer de backend y spike técnico de SEO con Next.js |
| [**Miguel**](../equipo/miguel.md) | Carril **24** — push iOS y Android con Expo |
| [**Fabio**](../equipo/fabio.md) | Carril **33** — read model de métricas de partner |

---

## Día a día

### Lunes 23 de noviembre

Apertura. **Se verifica que el dominio y las cuentas de Apple Developer y Google Play estén disponibles.** Si no lo están, el push queda `BLOCKED-EXTERNAL` y se declara hoy.

### Martes 24 de noviembre

Pablo: NativeWind y el package de tokens; un token cambia y se refleja en las cuatro plataformas.

### Miércoles 25 de noviembre

Miguel: registro de device tokens, batching de hasta 100 y manejo de `DeviceNotRegistered`.

### Jueves 26 de noviembre

Revisión cruzada a las 16:00. Leo presenta el spike de SEO con números de Lighthouse, no con opiniones.

### Viernes 27 de noviembre

QA y cierre. **Miguel demuestra un push recibido en un iPhone y en un Android físicos**, con evidencia en el PR.

---

## Atención esta semana

- Sin dominio verificado no hay universal links ni app links. Es el único bloqueo externo real del proyecto y hay que resolverlo esta semana.
- Pablo arranca F01–F03 esta semana porque Leo los necesita el lunes siguiente.

---

[← Semana 05](semana-05.md) · [Calendario](README.md) · [Semana 07 →](semana-07.md)

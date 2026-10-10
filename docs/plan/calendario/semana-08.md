# Semana 08 · Cierre del backend

**7 de diciembre al 11 de diciembre de 2026**

Última semana de backend. Al viernes, los 36 carriles tienen que estar en `DONE` y los 8 flujos E2E verdes entrando por Kong.

> **H4 · Backend completo** — viernes 11 de diciembre

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | **F06** y **F07** — i18n universal y pipeline de EAS Build |
| [**Leo**](../equipo/leo.md) | **F09** — motor de templates theme-driven |
| [**Miguel**](../equipo/miguel.md) | **F15** y **F16** — RSVP público y gestión de invitados |
| [**Fabio**](../equipo/fabio.md) | Carril **36** — cotización y fulfillment declarado |

---

## Día a día

### Lunes 7 de diciembre

Apertura. Se revisa el tablero completo de los 36 carriles de backend y se identifica lo que no va a llegar.

### Martes 8 de diciembre

Fabio: `fulfillment` obligatorio para publicar un listing, o 422. Leo: los cinco layouts base.

### Miércoles 9 de diciembre

Pablo: EAS produce binarios firmados de iOS y Android desde CI.

### Jueves 10 de diciembre

Revisión cruzada a las 16:00. Leo demuestra que añadir un template es una fila en la base, sin desplegar.

### Viernes 11 de diciembre

**Hito H4**. Los 8 flujos E2E del backend verdes entrando por Kong. Lo que no llegue se declara `BLOCKED-EXTERNAL` con evidencia, nunca `PARTIAL`.

---

## Atención esta semana

- Un carril que llega al viernes en `PARTIAL` no cierra. O se termina, o se declara bloqueado con razón concreta.

---

[← Semana 07](semana-07.md) · [Calendario](README.md) · [Semana 09 →](semana-09.md)

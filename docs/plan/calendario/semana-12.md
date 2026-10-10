# Semana 12 · Integración y E2E web

**4 de enero al 8 de enero de 2027**

Vuelve la capacidad completa. Pablo corre los E2E globales mientras los otros cierran sus últimos carriles.

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | E2E web globales entrando por Kong |
| [**Leo**](../equipo/leo.md) | **F13** y **F14** — switches en UI y admin de plataforma |
| [**Miguel**](../equipo/miguel.md) | **F21** — app móvil del invitado por deep link |
| [**Fabio**](../equipo/fabio.md) | **F27** — redirección y atribución en el front |

---

## Día a día

### Lunes 4 de enero

Apertura. Se lista todo lo que queda abierto, con nombre y fecha.

### Martes 5 de enero

Pablo: los diez flujos E2E del frontend, incluido el de lead de partner.

### Miércoles 6 de enero

Fabio: el test que escanea el DOM y falla si algún enlace a partner escapa del redirector.

### Jueves 7 de enero

Revisión cruzada a las 16:00. Se revisan los umbrales: cobertura, Lighthouse y axe.

### Viernes 8 de enero

QA y cierre. Playwright verde y snapshots visuales aprobados en los tres breakpoints.

---

## Atención esta semana

- El test de Fabio que escanea el DOM es el que protege el modelo de negocio. Si un enlace directo se cuela, se pierden leads sin que falle nada.

---

[← Semana 11](semana-11.md) · [Calendario](README.md) · [Semana 13 →](semana-13.md)

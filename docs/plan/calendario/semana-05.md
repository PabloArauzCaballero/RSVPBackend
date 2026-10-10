# Semana 05 · El motor de leads

**16 de noviembre al 20 de noviembre de 2026**

Fabio construye lo que hace facturable al producto. Pablo cierra la plataforma de backend y abre el camino para que el resto empiece frontend.

> **H3 · Núcleo de negocio funcional** — viernes 20 de noviembre

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | Carriles **08** y **09** — Kong declarativo y CI/CD con Pact Broker |
| [**Leo**](../equipo/leo.md) | Carril **16** — Django, templates y media |
| [**Miguel**](../equipo/miguel.md) | Carril **23** — hexágono de notificaciones: email, WhatsApp y SMS |
| [**Fabio**](../equipo/fabio.md) | Carriles **31** y **32** — motor de redirección, dedupe y ranking |

---

## Día a día

### Lunes 16 de noviembre

Apertura. Pablo confirma el rate limiting de `/r/*` en Kong, que Fabio necesita para el carril 31.

### Martes 17 de noviembre

Fabio: el redirector responde **302**, nunca 301. Es la línea de código más cara del proyecto.

### Miércoles 18 de noviembre

Miguel: `NotificationChannelPort` con adaptadores conmutables por variable de entorno. Leo: outbox en Django con el mismo sobre que NestJS.

### Jueves 19 de noviembre

Revisión cruzada a las 16:00. Fabio demuestra la tabla de casos de `computeListingScore`.

### Viernes 20 de noviembre

**Hito H3**. Celebración publicable, RSVP confirmable, regalo reservable con concurrencia probada y lead medible.

---

## Atención esta semana

- El outbox de Django tiene que producir un sobre idéntico al de NestJS. Ningún compilador lo garantiza: lo garantiza el test de contrato.

---

[← Semana 04](semana-04.md) · [Calendario](README.md) · [Semana 06 →](semana-06.md)

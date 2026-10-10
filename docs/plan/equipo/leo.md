# Leo · Eje B — Celebración y Contenido

> Sos dueño del agregado raíz. Todo lo que hacen Miguel y Fabio cuelga de una `Celebration`, y los switches `AUTO_ACCEPT / RESTRICTED` que vos publicás deciden el comportamiento de sus dominios. Tu carril 12 es predecesor del 20 de Miguel y del 27 de Fabio: hacelo temprano.

---

## Lo que te pertenece

| | |
|---|---|
| **Servicios** | Celebration Site Service (NestJS), Template/Media Service (Django + DRF) |
| **Bases de datos** | `celebration_db`, `template_db` |
| **Conceptos clave** | `Celebration`, `EventTypeDefinition`, `CelebrationSettings`, publicación, i18n, timezone, templates y media |
| **Frontend** | Sitio público SEO, motor de templates, editor de contenido, admin de plataforma |

---

## Tu calendario

| Semana | Fechas | Carriles | Foco |
|---|---|---|---|
| 00 | 12–16 oct | — | Contract Freeze. Vos definís el contrato de `Celebration` y `EventTypeDefinition`, del que dependen los otros dos |
| 01 | 19–23 oct | [10](../carriles/lane-10-celebration-dominio-y-tenancy.md) | Dominio puro y tenancy |
| 02 | 26–30 oct | [11](../carriles/lane-11-event-type-definition-multievento.md) · [12](../carriles/lane-12-celebration-settings-auto-restricted.md) | Multi-evento y los 4 switches. **Miguel y Fabio te esperan acá** |
| 03 | 2–6 nov | [13](../carriles/lane-13-publicacion-y-validacion.md) · [14](../carriles/lane-14-i18n-timezone-moneda.md) | Publicación validada e internacionalización |
| 04 | 9–13 nov | [15](../carriles/lane-15-read-model-sitio-publico.md) | Proyección del sitio público |
| 05 | 16–20 nov | [16](../carriles/lane-16-template-media-django.md) | Django, templates y media |
| 06 | 23–27 nov | — | Buffer de backend + spike técnico de SEO con Next.js |
| 07 | 30 nov – 4 dic | F08 | Bootstrap de `seo-web` con SSR, sitemap y JSON-LD |
| 08 | 7–11 dic | F09 | Motor de templates theme-driven |
| 09 | 14–18 dic | F10 | Sitio público de la celebración |
| 10 🎄 | 21–25 dic | F11 | Onboarding y editor de contenido |
| 11 🎄 | 28 dic – 1 ene | F12 | Preview y publicación |
| 12 | 4–8 ene | F13 · F14 | Switches en UI y admin de plataforma |
| 13 | 11–15 ene | F24 | Buscador público de proveedores + estabilización |

---

## Tus carriles de backend

| # | Carril | Entregable que lo cierra |
|---|---|---|
| [10](../carriles/lane-10-celebration-dominio-y-tenancy.md) | Dominio y tenancy | Dominio sin framework; 404 cross-tenant en todos los endpoints |
| [11](../carriles/lane-11-event-type-definition-multievento.md) | Multi-evento | **Añadir BAUTIZO con un solo seed, sin tocar código, y publicar una celebración de ese tipo** |
| [12](../carriles/lane-12-celebration-settings-auto-restricted.md) | Settings AUTO/RESTRICTED | Los 4 switches persistidos y publicados por evento; cambio **no retroactivo** |
| [13](../carriles/lane-13-publicacion-y-validacion.md) | Publicación | Falta un campo → 422 con la lista exacta de faltantes, según el tipo de evento |
| [14](../carriles/lane-14-i18n-timezone-moneda.md) | i18n y tiempo | Fallback de locale; La Paz y Madrid cruzando medianoche y DST; `Money` con BOB |
| [15](../carriles/lane-15-read-model-sitio-publico.md) | Read model público | Borrar la proyección, reconstruirla por replay y que dé idéntica |
| [16](../carriles/lane-16-template-media-django.md) | Django y media | Uploads pre-firmados a MinIO, variantes, outbox con el mismo sobre. **Cambiar template no pierde contenido** |

---

## Lo que los demás esperan de vos, y cuándo

| Quién | Qué necesita | Para cuándo |
|---|---|---|
| Miguel | `CelebrationSettings` publicado (`unregisteredRsvpMode`, `extraCompanionMode`) | fin semana 02 |
| Fabio | `CelebrationSettings` publicado (`giftReservationMode`, `externalGiftMode`, `partnerPriorityEnabled`) | fin semana 02 |
| Miguel y Fabio | `CelebrationPublished.v1` y el read model público | fin semana 04 |
| Todos | `timeZone` y `defaultLocale` en el evento de celebración | fin semana 03 |

---

## Riesgos de tu eje

- **El carril 11 es el que más fácil se hace mal.** La tentación es poner un `switch (tipo)` en el código. Si lo hacés, el cliente internacional va a pedir un tipo nuevo y vas a tener que desplegar. La prueba de que está bien hecho es literal: insertar una fila y que funcione.
- **Django es el único servicio en Python.** Su outbox y su sobre de evento tienen que ser idénticos a los de NestJS, y eso no lo garantiza ningún compilador: lo garantiza el test de contrato. No lo dejes para el final del carril 16.
- **Timezone es la fuente de bugs número uno de este tipo de producto.** Todo en UTC en la base, todo renderizado en la tz de la celebración. Escribí los tests de DST antes que el código.

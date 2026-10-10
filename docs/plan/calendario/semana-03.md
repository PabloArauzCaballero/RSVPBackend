# Semana 03 · Reglas de negocio y modos de control

**2 de noviembre al 6 de noviembre de 2026**

Con la mensajería resuelta, cada eje implementa las reglas que distinguen a este producto: validación por tipo de evento, acompañantes, modos AUTO/RESTRICTED y catálogo de partners.

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | Carriles **05** y **06** — auth, contexto de tenant y telemetría |
| [**Leo**](../equipo/leo.md) | Carriles **13** y **14** — publicación validada, i18n y timezone |
| [**Miguel**](../equipo/miguel.md) | Carriles **20** y **21** — acompañantes, no registrados y proyecciones |
| [**Fabio**](../equipo/fabio.md) | Carriles **27** y **28** — modo AUTO_ACCEPT y catalogados vs externos |

---

## Día a día

### Lunes 2 de noviembre

Apertura. Miguel y Fabio ya consumen los switches de Leo; si falta algo del payload, se detecta hoy.

### Martes 3 de noviembre

Leo escribe los tests de DST con La Paz y Madrid antes que el código. Fabio prueba la no-retroactividad del cambio de modo.

### Miércoles 4 de noviembre

Pablo: `TenantContextGuard` sobre `AsyncLocalStorage` y el test de fuga cross-tenant que los otros tres van a reutilizar.

### Jueves 5 de noviembre

Revisión cruzada a las 16:00. Se verifica que ningún repositorio reciba `celebrationId` como opcional.

### Viernes 6 de noviembre

QA y cierre. Pablo demuestra una traza única que cubre HTTP, outbox, broker y consumidor.

---

## Atención esta semana

- El test de fuga cross-tenant de Pablo es el patrón que los otros tres copian en cada endpoint. Si sale mal, se replica mal catorce veces.

---

[← Semana 02](semana-02.md) · [Calendario](README.md) · [Semana 04 →](semana-04.md)

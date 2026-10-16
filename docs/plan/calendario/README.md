> **Replanificación vigente (16-oct-2026):** [slices verticales y gates de CodeGraph, UX/UI y animación](../revision-vertical-slice-2026-10-16.md). Las fechas y tareas de esta ficha son objetivos históricos sujetos a reestimación con evidencia de slices completos.

# Calendario · RSVP Backend y Frontend

Del **lunes 12 de octubre de 2026** al **viernes 15 de enero de 2027**. 14 semanas.
Semana laboral de lunes a viernes. Las semanas 10 y 11 caen en Navidad y Año Nuevo: **capacidad reducida**, planificadas con la mitad de carga.

---

## Vista general

| Semana | Fechas | Pablo | Leo | Miguel | Fabio |
|---|---|---|---|---|---|
| [**00**](semana-00.md) | 12–16 oct | CONTRACT FREEZE | CONTRACT FREEZE | CONTRACT FREEZE | CONTRACT FREEZE |
| [**01**](semana-01.md) | 19–23 oct | 01 · 02 | 10 | 17 | 25 |
| [**02**](semana-02.md) | 26–30 oct | 03 · 04 | 11 · 12 | 18 · 19 | 26 |
| [**03**](semana-03.md) | 2–6 nov | 05 · 06 | 13 · 14 | 20 · 21 | 27 · 28 |
| [**04**](semana-04.md) | 9–13 nov | 07 | 15 | 22 | 29 · 30 |
| [**05**](semana-05.md) | 16–20 nov | 08 · 09 | 16 | 23 | 31 · 32 |
| [**06**](semana-06.md) | 23–27 nov | F01 · F02 · F03 | buffer + spike SEO | 24 | 33 |
| [**07**](semana-07.md) | 30 nov – 4 dic | F04 · F05 | F08 | buffer + MSW | 34 · 35 |
| [**08**](semana-08.md) | 7–11 dic | F06 · F07 | F09 | F15 · F16 | 36 |
| [**09**](semana-09.md) | 14–18 dic | integración | F10 | F17 · F18 | F22 |
| [**10**](semana-10.md) 🎄 | 21–25 dic | refuerzo | F11 | F19 | F25 |
| [**11**](semana-11.md) 🎄 | 28 dic – 1 ene | refuerzo | F12 | F20 | F26 |
| [**12**](semana-12.md) | 4–8 ene | E2E web | F13 · F14 | F21 | F27 |
| [**13**](semana-13.md) | 11–15 ene | E2E móvil · EAS | F24 | F23 | F28 |

Los carriles numerados (01–36) son **backend**; los `FNN` son **frontend**.

---

## Por qué el calendario tiene esta forma

**Pablo va primero y eso no es negociable.** Sus carriles `01`–`05` (monorepo, infra, messaging, outbox, auth) son predecesores de todo lo demás en backend, y `F01`–`F05` lo son en frontend. Por eso hace backend sin pausa de la semana 1 a la 5, y plataforma de frontend de la 6 a la 8. Las semanas 9 a 13 las tiene libres a propósito: es el colchón para integrar, destrabar a los otros tres y correr los E2E globales.

**Los otros tres arrancan backend el mismo día** contra los contratos congelados y los `platform-*` de Pablo, que llegan en la semana 1–2. Mientras no existan, trabajan dominio puro y tests unitarios, que no necesitan infraestructura.

**El frontend no arranca hasta la semana 7** para Leo y la 8 para Miguel, porque antes no existen el design system ni el cliente de API. Fabio arranca frontend en la 9 porque su backend es el más grande (12 carriles).

**Las semanas 10 y 11 llevan un solo carril por persona.** Es Navidad y Año Nuevo: planificar carga completa ahí es planificar un retraso.

**La semana 13 no tiene carriles nuevos de riesgo**, solo cierre y estabilización.

---

## Ritual semanal

| Día | Qué pasa |
|---|---|
| **Lunes 09:00** | Apertura de semana. Cada uno declara su carril activo y lee su ficha completa, riesgos incluidos |
| **Martes a jueves** | Slices verticales. Checkpoint visible cada 3 operaciones materiales. `progress.py` en cada transición de fase |
| **Jueves 16:00** | Revisión cruzada de código: cada eje revisa el de otro, rotando |
| **Viernes 11:00** | QA dirigido + regresión + publicación de contratos |
| **Viernes 16:00** | Cierre. Estado declarado con la Claim Ladder. `REGRESSION_VERIFIED` o no hay `DONE` |

---

## Qué hacer si un carril se atrasa

1. **No arrastres el atraso en silencio.** Anotalo en `docs/progress/BLOCKERS.md` el mismo día que lo detectás.
2. **Si el bloqueo es de otro eje**, seguí contra el stub de Pact. El contrato es la verdad; el servicio del otro es un detalle de implementación.
3. **Si el bloqueo es externo** (una cuenta, un dominio, una decisión del cliente), el requisito queda `BLOCKED-EXTERNAL` con evidencia y el carril puede cerrar sin él.
4. **Si es tuyo y no se resuelve en un día**, se reparte: el colchón de Pablo en las semanas 9–13 existe para esto.

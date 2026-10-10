# Semana 04 · Identidad, proyecciones y alta de partners

**9 de noviembre al 13 de noviembre de 2026**

Semana de carga más liviana a propósito: Pablo entra en Spring Boot, que es el único servicio en Java y no tiene quien lo cubra.

---

## Quién hace qué

| Persona | Carriles de la semana |
|---|---|
| [**Pablo**](../equipo/pablo.md) | Carril **07** — Identity Service completo en Spring Boot |
| [**Leo**](../equipo/leo.md) | Carril **15** — read model del sitio público |
| [**Miguel**](../equipo/miguel.md) | Carril **22** — derecho al olvido en cascada |
| [**Fabio**](../equipo/fabio.md) | Carriles **29** y **30** — onboarding de proveedor y listings con geo Bolivia |

---

## Día a día

### Lunes 9 de noviembre

Apertura. Fabio confirma la fuente de los datos de geografía boliviana; se cita en el seed, no se inventa.

### Martes 10 de noviembre

Pablo: dominio de Identity y JWT RS256 con JUnit 5 y ArchUnit. Leo: proyección por evento.

### Miércoles 11 de noviembre

Fabio: la invariante de al menos un destino de redirección obligatorio, o 422.

### Jueves 12 de noviembre

Revisión cruzada a las 16:00. Miguel demuestra que tras el borrado no queda PII en logs ni evidencias.

### Viernes 13 de noviembre

QA y cierre. Leo demuestra el replay: borrar la proyección, reconstruirla y comparar.

---

## Atención esta semana

- Pablo está solo en Java. Si el carril 07 se complica, nadie puede entrar a ayudar sin perder una semana entendiendo el proyecto. Empezar por dominio y tests, que no dependen de infraestructura.

---

[← Semana 03](semana-03.md) · [Calendario](README.md) · [Semana 05 →](semana-05.md)

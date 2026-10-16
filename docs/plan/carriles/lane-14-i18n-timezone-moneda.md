# Carril 14 · Internacionalización, timezone y moneda

| | |
|---|---|
| **Responsable** | [Leo](../equipo/leo.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `apps/celebration-site-service` |
| **Predecesores** | 10 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El cliente es internacional. El contenido se traduce, las horas se interpretan en la zona del evento y los montos llevan su moneda. La timezone es la fuente de bugs número uno en este tipo de producto: los tests de horario de verano se escriben antes que el código.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-14-01` | Traducciones en `celebration_translations` con fallback | Pedir `fr-FR` no soportado devuelve el `defaultLocale` |
| `REQ-14-02` | `Accept-Language` propagado desde Kong | El idioma de la respuesta sigue la cabecera cuando está soportado |
| `REQ-14-03` | Todo timestamp en `timestamptz` y UTC en la base | Ninguna columna de fecha es `timestamp` sin zona |
| `REQ-14-04` | **Las horas se evalúan en la `timeZone` IANA de la celebración** | Un evento en `America/La_Paz` consultado desde `Europe/Madrid` muestra la hora local del evento |
| `REQ-14-05` | `Money` como entero en unidades menores más ISO-4217 | No existe ningún `float` para dinero en el código |
| `REQ-14-06` | `BOB` por defecto, multi-moneda soportado | Una celebración puede fijar otra moneda sin tocar código |

---

## Qué se construye

- `apps/celebration-site-service/src/domain/model/money.ts`
- `apps/celebration-site-service/src/domain/model/translations.ts`
- `apps/celebration-site-service/src/application/query/resolve-locale.ts`
- `packages/platform-testing/src/timezone.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Guardar zona IANA y moneda de una celebración y exponer un instante formateable sin pérdida de precisión.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-14-01, REQ-14-02, REQ-14-03, REQ-14-04, REQ-14-05, REQ-14-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F06 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F06 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Value object `Money` y prohibición de coma flotante.
2. Tablas de traducción y resolución de locale con fallback.
3. Normalización a UTC y evaluación en la zona del evento.
4. Pruebas de horario de verano y cruce de medianoche.

---

## Plan de pruebas

- **Cruce de medianoche**: un evento a las 23:30 en La Paz consultado desde Madrid.
- **Horario de verano**: un evento en `Europe/Madrid` el fin de semana del cambio de hora.
- Fallback de locale a `defaultLocale` cuando el pedido no está soportado.
- `Money` en BOB y en USD, con redondeo correcto.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] No hay ningún `new Date()` sin zona explícita en el servicio.
- [ ] Los helpers de timezone quedan en `platform-testing` para que los reutilicen los otros ejes.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-14/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Escribir el código primero y los tests de DST después casi siempre termina en un rediseño. Al revés funciona.
- Un `float` para dinero no falla hoy; falla el día que alguien suma cien precios.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 14 completo
```

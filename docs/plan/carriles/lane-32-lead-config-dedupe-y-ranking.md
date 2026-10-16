# Carril 32 · Configuración de leads, deduplicación y ranking

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [05](../calendario/semana-05.md) · 16 de noviembre al 20 de noviembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 31 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Que el lead que se cobra sea un lead de verdad, y que los proveedores verificados y de pago aparezcan primero. Son las dos reglas que hacen de esto un negocio y no un contador de clics.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-32-01` | `leadConfig` por proveedor | Destinos habilitados, plantilla UTM, ventana de dedupe, tope mensual y modelo de facturación |
| `REQ-32-02` | Dedupe por sesión, listing y destino dentro de la ventana | El segundo clic en 30 minutos queda `INVALID(dup)` |
| `REQ-32-03` | Detección de bots por user-agent | Un crawler conocido queda `INVALID(bot)` |
| `REQ-32-04` | Los inválidos no cuentan como facturables | Las métricas distinguen leads totales de leads válidos |
| `REQ-32-05` | **Alcanzar el tope baja el ranking pero no oculta el listing** | El listing sigue visible y se emite `ProviderLeadCapReached.v1` |
| `REQ-32-06` | `computeListingScore` como función pura con tabla de casos | Verificado sobre no verificado, ciudad sobre departamento sobre país, PREMIUM pondera, tope agotado penaliza |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/lead-config.ts`
- `apps/provider-catalog-service/src/domain/policy/lead-dedupe.ts`
- `apps/provider-catalog-service/src/domain/policy/bot-detection.ts`
- `apps/provider-catalog-service/src/domain/policy/compute-listing-score.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Configurar una regla de lead y comprobar deduplicación de dos aperturas equivalentes.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-32-01, REQ-32-02, REQ-32-03, REQ-32-04, REQ-32-05, REQ-32-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F27 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F27 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. `leadConfig` y su edición desde el portal del proveedor.
2. Deduplicación por ventana configurable.
3. Detección de bots y marcado de inválidos.
4. Ranking como función pura con tabla de casos exhaustiva.

---

## Plan de pruebas

- Tabla de casos de dedupe: dentro de ventana, fuera de ventana, distinto destino, distinta sesión.
- Tabla de user-agents: navegadores reales y crawlers conocidos.
- **Tabla de casos de ranking** cubriendo cada factor por separado y combinados.
- Tope alcanzado: baja en el orden pero sigue presente en la respuesta.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El ranking es una función pura, testeable sin base de datos.
- [ ] Los pesos del ranking están en configuración, no incrustados en el código.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-32/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Ocultar un listing al alcanzar el tope rompe la experiencia del usuario y la relación comercial con el partner. Está explícitamente prohibido y probado.
- Una ventana de dedupe demasiado larga pierde leads legítimos; demasiado corta cobra de más. Es un parámetro, no una constante.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 32 completo
```

# Carril 31 · Motor de redirección y leads

| | |
|---|---|
| **Responsable** | [Fabio](../equipo/fabio.md) |
| **Semana** | [05](../calendario/semana-05.md) · 16 de noviembre al 20 de noviembre de 2026 |
| **Componente** | `apps/provider-catalog-service` |
| **Predecesores** | 30 · 08 (Pablo) |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El carril donde ocurre el negocio. Ningún enlace a un partner sale directo: todos pasan por aquí, que registra el lead, inyecta los parámetros de campaña y redirige. Si esto falla, el producto entero deja de ganar dinero sin que nada se rompa visiblemente.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-31-01` | `GET /r/{listingId}?destination=...` registra el `Lead` y redirige | El lead queda persistido antes de responder |
| `REQ-31-02` | **Responde 302, nunca 301** | Una segunda visita del mismo navegador vuelve a llegar al servidor |
| `REQ-31-03` | UTM y `correlationId` inyectados en la URL final | La URL resuelta los contiene, verificado en el test |
| `REQ-31-04` | El lead guarda contexto completo | Celebración, invitado o sesión, superficie, categoría, geo, idioma, dispositivo y referrer |
| `REQ-31-05` | `ProviderLeadGenerated.v1` emitido por outbox | Alimenta las métricas del carril 33 |
| `REQ-31-06` | Un destino no habilitado devuelve 404 | No se puede forzar un canal que el partner no ofrece |

---

## Qué se construye

- `apps/provider-catalog-service/src/domain/model/lead.ts`
- `apps/provider-catalog-service/src/domain/policy/destination-resolver.ts`
- `apps/provider-catalog-service/src/application/command/generate-lead.ts`
- `apps/provider-catalog-service/src/interface/rest/redirect.controller.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Abrir /r/{listingId} y observar redirección y lead atribuido, sin enlace directo ni duplicado.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-31-01, REQ-31-02, REQ-31-03, REQ-31-04, REQ-31-05, REQ-31-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** F27 frontend; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar F27 frontend si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Agregado `Lead` y resolución de destino con UTM.
2. Endpoint de redirección con persistencia previa a la respuesta.
3. Captura de contexto: superficie, geo, dispositivo y referrer.
4. Evento por outbox y verificación de extremo a extremo.

---

## Plan de pruebas

- **El código de respuesta es exactamente 302.** Un test que falla si alguien lo cambia a 301.
- La URL resuelta contiene los UTM y el `correlationId`.
- Destino no habilitado: 404.
- El lead se persiste aunque el partner esté suspendido, marcado como inválido.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Existe un test explícito y comentado sobre por qué es 302 y no 301.
- [ ] El rate limiting de Kong sobre esta ruta está verificado y no corta el tráfico legítimo.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-31/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- **301 en vez de 302 mata el negocio en silencio.** El navegador cachea la redirección permanente y los clics siguientes nunca llegan al servidor: dejás de contar leads sin que falle nada.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 31 completo
```

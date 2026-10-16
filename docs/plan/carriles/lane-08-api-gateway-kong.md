# Carril 08 · API Gateway declarativo

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [05](../calendario/semana-05.md) · 16 de noviembre al 20 de noviembre de 2026 |
| **Componente** | `infra/kong/kong.yml` · Kong DB-less |
| **Predecesores** | 07 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Una sola puerta de entrada, configurada como código. Kong valida el JWT, limita la tasa, inyecta el `correlationId` y enruta a los siete servicios. Ningún cambio se hace por consola: todo pasa por un pull request sobre `kong.yml`.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-08-01` | Rutas declaradas para los 7 servicios | Cada servicio responde a través del gateway, no solo directo |
| `REQ-08-02` | Plugin JWT validando contra el JWKS de Identity | Una petición sin token a una ruta protegida devuelve 401 **en el gateway** |
| `REQ-08-03` | Rutas públicas explícitamente exentas | El RSVP por token y `/r/*` funcionan sin sesión |
| `REQ-08-04` | Rate limiting agresivo en rutas públicas | Superar el límite devuelve 429 con `Retry-After` |
| `REQ-08-05` | `correlation-id` inyectado en toda petición | El identificador aparece en los logs de los 7 servicios |
| `REQ-08-06` | CORS y límite de tamaño de petición configurados | Un origen no permitido es rechazado; un cuerpo excesivo devuelve 413 |

---

## Qué se construye

- `infra/kong/kong.yml`
- `infra/kong/plugins/`
- `docs/runbooks/gateway.md`
- `e2e/gateway/`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Pasar una petición autenticada por Kong hasta un servicio y comprobar una denegación real.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-08-01, REQ-08-02, REQ-08-03, REQ-08-04, REQ-08-05, REQ-08-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** sin pareja directa; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar sin pareja directa si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Rutas y upstreams de los 7 servicios.
2. JWT contra JWKS y exenciones explícitas de las rutas públicas.
3. Rate limiting, CORS, tamaño máximo y detección de bots.
4. Pruebas de extremo a extremo entrando siempre por el gateway.

---

## Plan de pruebas

- Petición sin token a una ruta protegida: 401 en el gateway, sin llegar al servicio.
- Ráfaga sobre `/rsvp` por encima del límite: 429.
- Ráfaga sobre `/r/{listingId}`: limitada pero sin romper el flujo legítimo.
- Verificación de que el `correlationId` del gateway aparece en el log del servicio final.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Los flujos E2E del proyecto entran por Kong, nunca directo al servicio.
- [ ] El runbook explica cómo añadir una ruta nueva sin romper las existentes.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-08/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un rate limit demasiado agresivo en `/r/*` recorta leads legítimos; demasiado laxo invita al fraude de clics. Hay que medirlo, no adivinarlo.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 08 completo
```

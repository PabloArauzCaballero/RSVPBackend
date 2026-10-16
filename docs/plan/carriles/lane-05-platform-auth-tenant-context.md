# Carril 05 · Autenticación y contexto de tenant

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [03](../calendario/semana-03.md) · 2 de noviembre al 6 de noviembre de 2026 |
| **Componente** | `packages/platform-auth` |
| **Predecesores** | 04 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Validar el JWT en cada servicio contra el JWKS de Identity —aunque Kong ya lo haya hecho— y propagar el `celebrationId` por toda la petición de forma que ningún repositorio pueda olvidarse de filtrar por tenant.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-05-01` | Guard que valida el JWT contra el JWKS, con caché y rotación de claves | Un token firmado con otra clave devuelve 401 |
| `REQ-05-02` | `TenantContextGuard` extrae `celebrationId` del path o del token | El contexto está disponible en cualquier capa sin pasarlo por parámetro |
| `REQ-05-03` | El contexto viaja en `AsyncLocalStorage` | Dos peticiones concurrentes a distinta celebración no se contaminan |
| `REQ-05-04` | Los repositorios reciben `celebrationId` como argumento obligatorio | Omitirlo es un error de compilación de TypeScript, no un fallo en ejecución |
| `REQ-05-05` | **Test de fuga cross-tenant reutilizable** | El helper permite escribir el test de fuga de cualquier endpoint en tres líneas |
| `REQ-05-06` | Rutas públicas exentas de JWT pero sujetas a rate limit | El RSVP por token funciona sin sesión y está limitado por tasa |

---

## Qué se construye

- `packages/platform-auth/src/jwt/`
- `packages/platform-auth/src/tenant/`
- `packages/platform-auth/src/guards/`
- `packages/platform-testing/src/cross-tenant.ts`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Autenticar una petición con tenant válido y rechazar otra de tenant ajeno en el mismo caso de uso.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-05-01, REQ-05-02, REQ-05-03, REQ-05-04, REQ-05-05, REQ-05-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** sin pareja directa; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar sin pareja directa si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Validación de JWT contra JWKS con caché y rotación.
2. `TenantContext` sobre `AsyncLocalStorage` y su guard.
3. Tipado de repositorios que obliga a pasar `celebrationId`.
4. Helper de test de fuga cross-tenant para los otros tres ejes.

---

## Plan de pruebas

- Token de otra celebración contra un recurso ajeno: 404, nunca 403 con información.
- Dos peticiones concurrentes de celebraciones distintas: cada una ve solo lo suyo.
- Token expirado, token con firma inválida y token sin claims: 401 en los tres casos.
- Rotación de clave en el JWKS: los tokens viejos siguen validando hasta que expiran.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Los otros tres ejes pueden escribir su test de fuga cross-tenant copiando tres líneas.
- [ ] La documentación explica por qué se revalida el JWT aunque Kong ya lo valide.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-05/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Devolver 403 en vez de 404 en un recurso de otro tenant filtra que ese recurso existe.
- Si `celebrationId` es opcional en la firma del repositorio, alguien lo va a olvidar. Que no compile es la única garantía real.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 05 completo
```

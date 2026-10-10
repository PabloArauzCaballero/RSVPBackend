# Carril 18 · Tokens de acceso del invitado

| | |
|---|---|
| **Responsable** | [Miguel](../equipo/miguel.md) |
| **Semana** | [02](../calendario/semana-02.md) · 26 de octubre al 30 de octubre de 2026 |
| **Componente** | `apps/guest-rsvp-service` |
| **Predecesores** | 17 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El invitado no tiene cuenta. Su única credencial es un token opaco dentro de un magic link. Es la superficie de ataque principal del flujo público: se guarda hasheado, se puede revocar, está limitado por tasa y nunca aparece en un log.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-18-01` | Token opaco de alta entropía, uno por invitado | Dos invitados nunca comparten token |
| `REQ-18-02` | **Solo el hash se guarda en la base** | Una fuga de la base no permite suplantar a nadie |
| `REQ-18-03` | Token revocable | Un token revocado devuelve 401 inmediatamente |
| `REQ-18-04` | Token inexistente devuelve 401, no 404 | No se puede enumerar qué tokens existen |
| `REQ-18-05` | Token de otra celebración devuelve 404 | No se filtra la existencia de la celebración ajena |
| `REQ-18-06` | **El token nunca aparece en logs ni en trazas** | Una búsqueda del token en los logs de una petición completa no lo encuentra |

---

## Qué se construye

- `apps/guest-rsvp-service/src/domain/model/access-token.ts`
- `apps/guest-rsvp-service/src/application/command/issue-token.ts`
- `apps/guest-rsvp-service/src/application/command/revoke-token.ts`
- `apps/guest-rsvp-service/src/interface/rest/guards/guest-token.guard.ts`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Generación, hash y almacenamiento del token.
2. Guard de autenticación por token con los tres casos de error.
3. Emisión, reemisión y revocación desde el panel del anfitrión.
4. Redacción en logs y límite de tasa coordinado con Kong.

---

## Plan de pruebas

- Token válido: 200. Revocado: 401. Inexistente: 401. De otra celebración: 404.
- **Test de redacción**: ejecutar una petición completa y buscar el token en todos los logs generados.
- Test de fuerza bruta: N intentos fallidos activan el límite de tasa.
- Test de que reemitir un token invalida el anterior.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] La entropía del token está justificada por escrito.
- [ ] El límite de tasa está coordinado con la configuración de Kong del carril 08.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-18/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Un token en un log de acceso es una suplantación esperando a pasar. La redacción va en la capa de serialización, no en la disciplina de cada uno.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 18 completo
```

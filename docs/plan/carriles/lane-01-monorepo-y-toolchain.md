# Carril 01 · Monorepo y toolchain

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [01](../calendario/semana-01.md) · 19 de octubre al 23 de octubre de 2026 |
| **Componente** | Raíz del repositorio · Turborepo · Yarn 4 |
| **Predecesores** | Contract Freeze (semana 00) |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Dejar un monorepo poliglota donde los siete servicios —cinco en NestJS, uno en Spring Boot y uno en Django— se construyen, se lintean y se testean con un único comando. Las apps que no son JavaScript se integran mediante un `package.json` mínimo cuyos scripts delegan en Gradle o Poetry, de modo que Turbo las cachee y las incluya en `--affected` igual que a las demás.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-01-01` | Yarn 4 Workspaces con los 7 servicios y los 9 packages declarados | `yarn workspaces list` devuelve los 16 workspaces |
| `REQ-01-02` | `yarn turbo run build` construye los 3 runtimes | El build pasa en limpio desde un clon nuevo |
| `REQ-01-03` | `yarn turbo run test` ejecuta Jest, JUnit y pytest | Los tres informes aparecen en la salida |
| `REQ-01-04` | `yarn turbo run lint` aplica ESLint, Checkstyle y Ruff | Un error de estilo introducido a propósito hace fallar el comando |
| `REQ-01-05` | La caché de Turbo funciona para las apps no-JS | Una segunda corrida sin cambios devuelve `cache hit` en Java y en Python |
| `REQ-01-06` | Configuración compartida en `config-*` | Los 5 servicios NestJS extienden la misma base de TS, ESLint, Prettier y Jest |

---

## Qué se construye

- `package.json`
- `turbo.json`
- `tsconfig.base.json`
- `.yarnrc.yml`
- `.nvmrc`
- `packages/config-eslint/`
- `packages/config-ts/`
- `packages/config-jest/`
- `packages/config-prettier/`
- `apps/*/package.json (los 7, incluidos los wrappers de Gradle y Poetry)`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Raíz del workspace: Yarn 4, `turbo.json` con el grafo de tareas y un `hello world` en cada uno de los 7 servicios.
2. Packages `config-*` y adopción en los 5 NestJS.
3. Wrappers no-JS: `package.json` de Identity que llama a Gradle y el de Template/Media que llama a Poetry.
4. Caché y `--affected`: comprobación de que un cambio en un servicio no reconstruye los otros seis.

---

## Plan de pruebas

- Smoke test por servicio: el proceso arranca y responde `/health`.
- Test de la caché: dos corridas seguidas, la segunda con `cache hit` en los 7.
- Test de `--affected`: tocar `apps/gift-list-service` y verificar que solo se reconstruye ese.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Un clon nuevo en una máquina limpia llega a `build lint test` verde siguiendo solo el README.
- [ ] Las versiones de Node, Java y Python están fijadas y documentadas.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-01/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Integrar Gradle y Poetry en Turbo es la parte que más tiempo consume y la que nadie espera. Hacelo el martes, no el jueves.
- Si los `config-*` no se adoptan desde el día uno, cada servicio diverge y después nadie los unifica.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 01 completo
```

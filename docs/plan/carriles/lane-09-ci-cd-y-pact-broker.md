# Carril 09 · CI/CD y Pact Broker

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [05](../calendario/semana-05.md) · 16 de noviembre al 20 de noviembre de 2026 |
| **Componente** | `.github/workflows/` · GitHub Actions |
| **Predecesores** | 08 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Que cada pull request construya solo lo afectado, corra los tests de los tres runtimes, verifique los contratos entre servicios y publique las siete imágenes. Y que `@rsvp/contracts` se publique para que el repositorio de frontend lo consuma.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-09-01` | `turbo --affected` limita el trabajo a lo que cambió | Tocar un servicio no dispara el build de los otros seis |
| `REQ-09-02` | Matriz con los 3 runtimes | Node, Java y Python corren sus tests en el mismo pipeline |
| `REQ-09-03` | Pact Broker desplegado y verificando | Un cambio incompatible en un proveedor rompe el build del consumidor |
| `REQ-09-04` | `gitleaks` bloqueante | Un secreto introducido a propósito hace fallar el pipeline |
| `REQ-09-05` | Umbrales de cobertura bloqueantes | Bajar de 90 % en `domain/` hace fallar el build |
| `REQ-09-06` | **`@rsvp/contracts` publicado en GitHub Packages** | El repositorio de frontend puede instalarlo con una versión semántica |

---

## Qué se construye

- `.github/workflows/ci.yml`
- `.github/workflows/contracts-publish.yml`
- `.github/workflows/images.yml`
- `.github/workflows/pact.yml`
- `docs/runbooks/ci.md`

---

## Plan por slices

Cada slice es vertical y termina con sus pruebas en verde. No se pasa al siguiente con el anterior rojo.

1. Pipeline base con `--affected` y caché de Turbo.
2. Matriz de los tres runtimes y publicación de informes de cobertura.
3. Pact Broker, publicación del consumidor y verificación del proveedor.
4. Publicación de `@rsvp/contracts` y construcción de las 7 imágenes.

---

## Plan de pruebas

- Pull request de prueba que toca un solo servicio y verifica que el resto no se reconstruye.
- Pull request con un contrato roto a propósito: el pipeline del consumidor falla.
- Pull request con un secreto de prueba: `gitleaks` lo detecta.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] Un pull request típico termina en menos de diez minutos.
- [ ] El repositorio de frontend instala `@rsvp/contracts` y compila.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-09/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Si la publicación de contratos se atrasa, el frontend arranca a ciegas en la semana 6. Es la dependencia más silenciosa del proyecto.

---

## Cómo se activa

```
/rsvp-master Ejecuta el carril 09 completo
```

# Carril 02 · Infraestructura local

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [01](../calendario/semana-01.md) · 19 de octubre al 23 de octubre de 2026 |
| **Componente** | `infra/` · Docker Compose |
| **Predecesores** | 01 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

Un solo comando levanta todo lo que el equipo necesita para trabajar: siete bases de datos PostgreSQL independientes, RabbitMQ, Redis, MinIO, Kong y el stack completo de observabilidad. Sin esto, los otros tres ejes no pueden pasar de dominio puro.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-02-01` | `docker compose up -d` deja todos los contenedores en `healthy` | `docker compose ps` no muestra ningún servicio degradado |
| `REQ-02-02` | Siete bases independientes, una por servicio | Conectarse a `gift_db` y comprobar que no existen las tablas de `guest_db` |
| `REQ-02-03` | RabbitMQ arranca con su topología ya cargada | La consola de administración muestra los 7 exchanges y sus colas sin intervención manual |
| `REQ-02-04` | MinIO arranca con el bucket de media creado | Subir un archivo de prueba con las credenciales del `.env.example` funciona |
| `REQ-02-05` | El stack OTel recibe y muestra datos | Un span de prueba aparece en Tempo y una métrica en Prometheus |
| `REQ-02-06` | Mailhog disponible para ver los correos de desarrollo | La interfaz responde en `localhost:8025` |

---

## Qué se construye

- `infra/docker-compose.yml`
- `infra/postgres/init/01-databases.sql`
- `infra/postgres/init/02-roles-y-rls.sql`
- `infra/rabbitmq/definitions.json`
- `infra/observability/otel-collector.yaml`
- `infra/observability/prometheus.yml`
- `infra/observability/tempo.yaml`
- `infra/observability/loki.yaml`
- `infra/observability/grafana/`
- `.env.example`
- `docs/runbooks/arranque-local.md`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Levantar un servicio y su dependencia real con Compose; comprobar salud y caída controlada.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-02-01, REQ-02-02, REQ-02-03, REQ-02-04, REQ-02-05, REQ-02-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** sin pareja directa; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar sin pareja directa si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Bases de datos: Postgres con las 7 bases, roles y healthcheck.
2. Broker y caché: RabbitMQ con `definitions.json`, Redis, MinIO con bucket inicial.
3. Observabilidad: Collector, Prometheus, Tempo, Loki y Grafana con datasources ya provisionados.
4. Runbook de arranque y `.env.example` con todas las variables documentadas.

---

## Plan de pruebas

- Script de verificación que espera a que los 7 healthchecks estén verdes y falla con un mensaje claro si alguno no sube.
- Test de aislamiento: un usuario de `gift_db` no puede leer `guest_db`.
- Test de humo del stack OTel: emitir un span y encontrarlo en Tempo.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El runbook permite a alguien que nunca vio el proyecto levantarlo en menos de quince minutos.
- [ ] Ningún secreto real en el repositorio; `gitleaks` pasa limpio.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-02/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Los healthchecks mal configurados son peores que no tenerlos: el `up` devuelve éxito y el servicio todavía no acepta conexiones.
- La topología de RabbitMQ va en `definitions.json` versionado. Si alguien la crea a mano, se pierde en el próximo `down -v`.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 02 completo
```

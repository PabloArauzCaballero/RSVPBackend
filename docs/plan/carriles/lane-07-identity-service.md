# Carril 07 · Identity Service

| | |
|---|---|
| **Responsable** | [Pablo](../equipo/pablo.md) |
| **Semana** | [04](../calendario/semana-04.md) · 9 de noviembre al 13 de noviembre de 2026 |
| **Componente** | `apps/identity-service` · Spring Boot / Java 21 |
| **Predecesores** | 05 |
| **Estado inicial** | `NOT_STARTED` |

---

## Objetivo

El único servicio en Java. Emite los tokens que todo el sistema valida, y modela usuarios, roles y organizaciones. Al ser el único Spring Boot, no hay nadie que pueda cubrirlo: conviene empezar por el dominio puro y sus pruebas, que no dependen de infraestructura.

---

## Requisitos

Cada requisito es falsable: o pasa su prueba, o no pasa. No hay interpretación.

| ID | Requisito | Cómo se demuestra |
|---|---|---|
| `REQ-07-01` | Dominio hexagonal con `User`, `Role`, `Organization` y `OrganizationMember` | ArchUnit falla si el dominio importa Spring o JPA |
| `REQ-07-02` | JWT RS256 con access de 15 minutos | Un token alterado en un solo byte es rechazado |
| `REQ-07-03` | Refresh opaco de 30 días en Redis con rotación | Reutilizar un refresh ya rotado invalida toda la cadena y lo registra |
| `REQ-07-04` | `GET /.well-known/jwks.json` sirve la clave pública | Kong y los servicios validan contra ese endpoint |
| `REQ-07-05` | Roles `ADMIN`, `HOST`, `PLANNER` y `PROVIDER` con matriz de permisos | Tests parametrizados cubren los 4 roles contra todos los endpoints |
| `REQ-07-06` | Organizaciones con miembros, para wedding planners | Un planner ve las celebraciones de su organización y ninguna otra |

---

## Qué se construye

- `apps/identity-service/src/main/java/.../domain/`
- `apps/identity-service/src/main/java/.../application/`
- `apps/identity-service/src/main/java/.../infrastructure/`
- `apps/identity-service/src/main/java/.../interfaces/`
- `apps/identity-service/src/test/java/.../ArchitectureTest.java`
- `apps/identity-service/build.gradle.kts`
- `apps/identity-service/src/main/resources/db/migration/ (Flyway)`

---

## Primer slice vertical replanificado (16-oct-2026)

**Resultado demostrable:** Registrar una identidad mínima y autenticarla a través de la API pública con errores verificables.

- **REQs:** relacionar el primer corte con los requisitos aplicables (REQ-07-01, REQ-07-02, REQ-07-03, REQ-07-04, REQ-07-05, REQ-07-06) en la evidencia antes de implementarlo; los demás se reparten en cortes posteriores. Este primer corte no cierra el carril.
- **Frontera entre repos:** sin pareja directa; coordinar contrato versionado y prueba de integración cuando el resultado la requiera.
- **Prueba mínima:** caso de éxito y caso negativo en runtime pertinente, con comando/artefacto y resultado en la evidencia del carril. Un mock solo prueba su capa.
- **Gates de interfaz:** N/A backend puro; coordinar sin pareja directa si cambia UX. **Animación:** N/A salvo contrato que afecte transición.
- **Descubrimiento:** consultar CodeGraph para flujo e impacto y confirmar en archivos actuales.

Los puntos del inventario siguiente describen capacidades previstas, **no** slices verticales listos para ejecutar. Corta cada capacidad restante por comportamiento y cierra su prueba antes de avanzar; sigue [la revisión general](../revision-vertical-slice-2026-10-16.md).

---

## Inventario histórico de capacidades

Esta lista conserva el inventario original por componentes. No representa slices ejecutables ni el orden de entrega.

1. Dominio puro y tests unitarios, sin Spring.
2. Persistencia con JPA, migraciones Flyway y Testcontainers.
3. Emisión y validación de JWT, JWKS y refresh rotativo en Redis.
4. Organizaciones, roles y matriz de permisos; outbox con el mismo sobre que NestJS.

---

## Plan de pruebas

- ArchUnit: `domain` no depende de `org.springframework` ni de `jakarta.persistence`.
- Integración con Testcontainers de Postgres y Redis.
- RestAssured contra los endpoints, cubriendo 200, 401, 403 y 422.
- Test de detección de reuso de refresh: la cadena completa queda invalidada.

---

## Definition of Done

Además del [DoD general](../README.md#reglas-que-no-se-negocian), este carril exige:

- [ ] El sobre de evento que emite Identity es byte a byte compatible con el de los NestJS.
- [ ] La rotación de claves de firma está documentada y probada.

Y en todos los casos:

- [ ] Todos los `REQ` en `PASS`, o `BLOCKED-EXTERNAL` con evidencia concreta. `PARTIAL` no cierra.
- [ ] El dominio no importa framework; el test arquitectónico está verde.
- [ ] Cobertura ≥ 90 % en `domain/` y `application/`, ≥ 80 % global.
- [ ] La suite del carril corre 3 veces seguidas en CI sin un solo fallo.
- [ ] Migración versionada y reversible; `.env.example` actualizado.
- [ ] OpenAPI y AsyncAPI al día; Pact publicado y verificado.
- [ ] Trazas con `correlationId`; logs sin PII ni secretos.
- [ ] Evidencia en `docs/progress/evidence/lane-07/`; `STATUS_LOG.md` y `DECISIONS.md` al día.
- [ ] Revisión de código por otro eje aprobada.
- [ ] Estado final `REGRESSION_VERIFIED` antes de `DONE`.

---

## Riesgos y trampas conocidas

- Estás solo en Java. Si el carril se complica, nadie entra a ayudarte sin perder una semana.
- El refresh opaco en Redis se pierde si Redis se reinicia sin persistencia. Decidilo a conciencia y documentalo.

---

## Preguntas abiertas

Lo que no se puede resolver sin el propietario no se inventa.

- ¿Cuánto dura la sesión de un invitado que entra por magic link? Hoy el token no expira salvo revocación explícita.

---

## Cómo se activa

```
Usa $rsvp-backend-lane para ejecutar el carril 07 completo
```

# Carril 14 · Internacionalización, timezone y moneda

| REQ | Estado | Prueba |
|---|---|---|
| REQ-14-01 traducciones con fallback | PASS | `domain.test.mjs` REQ-14-01/02 · `http.test.mjs` REQ-15 (`fr-FR` → `es-BO`) |
| REQ-14-02 `Accept-Language` respetado | PASS | `http.test.mjs` REQ-15 y REQ-11-01/05 · `Content-Language` y `Vary` en la respuesta pública; Kong reenvía la cabecera sin tocarla |
| REQ-14-03 todo `timestamptz` en UTC | PASS | `architecture.test.mjs` (SQL) · `postgres.integration` (`information_schema`: ninguna columna `timestamp without time zone`) |
| REQ-14-04 horas en la zona de la celebración | PASS | `domain.test.mjs` (23:30 en La Paz cruza medianoche; DST de Madrid: hueco de primavera y doble 02:30 de otoño) · `architecture.test.mjs` lanza un proceso con `TZ=Europe/Madrid` y sigue viendo 23:30 de La Paz |
| REQ-14-05 `Money` entero + ISO-4217, sin float | PASS | `domain.test.mjs` (redondeo bancario con enteros, reparto sin perder centavos, cien precios suman exacto) · `architecture.test.mjs` (ni `parseFloat` ni `toFixed`) |
| REQ-14-06 BOB por defecto, multi-moneda | PASS | `domain.test.mjs` (BOB, USD, CLP, KWD); la moneda es editable por celebración |

Las horas se envían como instante con offset o como hora de pared `YYYY-MM-DDTHH:mm`, que se interpreta en la zona de la celebración. La API devuelve `localTimes` ya calculado para que ningún cliente haga cuentas de zona horaria.

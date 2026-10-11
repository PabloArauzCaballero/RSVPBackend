# Importación de invitados

El modo es **parcial**: cada fila válida se importa y cada inválida se devuelve con `line`, `field` y `reason`. No se descarta un lote completo por una fila defectuosa.

```csv
name,email,locale,allowedCompanions
Ana Pérez,ana@example.com,es-BO,2
John Smith,john@example.com,en-US,0
```

`locale` y `allowedCompanions` pueden quedar vacíos: toman `defaultLocale` y el valor por defecto de la celebración respectivamente.

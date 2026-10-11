[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$expectedServices = @('postgres', 'rabbitmq', 'redis', 'minio', 'mailhog', 'kong', 'otel-collector', 'prometheus', 'tempo', 'loki', 'grafana')
$expectedDatabases = @('identity_db', 'celebration_db', 'guest_db', 'notification_db', 'gift_db', 'provider_db', 'template_db')
$expectedExchanges = @('identity.events', 'celebration.events', 'guest-rsvp.events', 'gift-list.events', 'provider-catalog.events', 'notification.events', 'template-media.events')

function Invoke-LocalProbe([string]$Uri, [string[]]$Arguments = @()) {
  & curl.exe --silent --show-error --fail @Arguments $Uri | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "The local endpoint $Uri did not respond successfully." }
}

$jsonLines = & docker compose ps --format json
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker Compose status. Run docker compose up -d first.' }
$containers = @($jsonLines | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })
foreach ($service in $expectedServices) {
  $container = $containers | Where-Object { $_.Service -eq $service } | Select-Object -First 1
  if ($null -eq $container) { throw "Expected service '$service' is missing from docker compose ps." }
  if ($container.State -ne 'running') { throw "Service '$service' is '$($container.State)' instead of running." }
  if ($container.Health -and $container.Health -ne 'healthy') { throw "Service '$service' health is '$($container.Health)'." }
}

Invoke-LocalProbe 'http://localhost:9000/minio/health/live'
Invoke-LocalProbe 'http://localhost:8001/status'
Invoke-LocalProbe 'http://localhost:8025/'
Invoke-LocalProbe 'http://localhost:9090/-/ready'
Invoke-LocalProbe 'http://localhost:3000/api/health'

$databaseNames = & docker compose exec -T postgres psql -U postgres -d postgres -Atc "SELECT datname FROM pg_database WHERE datname LIKE '%_db' ORDER BY datname"
if ($LASTEXITCODE -ne 0) { throw 'Could not query PostgreSQL databases.' }
foreach ($database in $expectedDatabases) {
  if ($databaseNames -notcontains $database) { throw "Expected database '$database' was not initialized." }
}

$rabbitUser = if ($env:RABBITMQ_DEFAULT_USER) { $env:RABBITMQ_DEFAULT_USER } else { 'local-rabbitmq' }
$rabbitPassword = if ($env:RABBITMQ_DEFAULT_PASS) { $env:RABBITMQ_DEFAULT_PASS } else { 'local-rabbitmq-password' }
$exchangeJson = & curl.exe --silent --show-error --fail --user "${rabbitUser}:${rabbitPassword}" 'http://localhost:15672/api/exchanges/%2F'
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect RabbitMQ topology.' }
$exchangeNames = @($exchangeJson | ConvertFrom-Json | ForEach-Object name)
foreach ($exchange in $expectedExchanges) {
  if ($exchangeNames -notcontains $exchange) { throw "Expected RabbitMQ exchange '$exchange' was not loaded." }
}

Write-Host "Local infrastructure verified: $($expectedServices.Count) services, $($expectedDatabases.Count) databases and $($expectedExchanges.Count) exchanges."

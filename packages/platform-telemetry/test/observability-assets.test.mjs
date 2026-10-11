import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dashboardDirectory = join(root, 'infra/observability/grafana/provisioning/dashboards/json');

test('provisions five Grafana dashboards', () => {
  const dashboards = readdirSync(dashboardDirectory).filter((file) => file.endsWith('.json'));
  assert.equal(dashboards.length, 5);
  for (const dashboard of dashboards) assert.ok(JSON.parse(readFileSync(join(dashboardDirectory, dashboard), 'utf8')).title);
});

test('ships a parking-queue alert rule and incident runbook', () => {
  const rules = readFileSync(join(root, 'infra/observability/prometheus-rules.yml'), 'utf8');
  assert.match(rules, /RsvpParkingQueueNotEmpty/);
  assert.equal(existsSync(join(root, 'docs/runbooks/observabilidad.md')), true);
});

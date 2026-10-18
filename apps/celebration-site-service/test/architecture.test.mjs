import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readSeeds } from '../dist/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');
const files = (dir) => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? files(join(dir, entry)) : [join(dir, entry)]));
const sources = files(src).filter((file) => file.endsWith('.ts'));
const layer = (file) => relative(src, file).split(sep)[0];
const importsOf = (file) => [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
const resolved = (file, specifier) => (specifier.startsWith('.') ? relative(src, join(file, '..', specifier)).split(sep)[0] : specifier);

test('REQ-10-01 · domain/ imports nothing but domain/: no framework, driver, node module or other layer', () => {
  const offenders = sources.filter((file) => layer(file) === 'domain').flatMap((file) => importsOf(file)
    .filter((specifier) => !specifier.startsWith('.') || resolved(file, specifier) !== 'domain')
    .map((specifier) => `${relative(src, file)} → ${specifier}`));
  assert.deepEqual(offenders, []);
});

test('application/ depends on domain/ and its own ports only', () => {
  const offenders = sources.filter((file) => layer(file) === 'application').flatMap((file) => importsOf(file)
    .filter((specifier) => !specifier.startsWith('.') || !['domain', 'application'].includes(resolved(file, specifier)))
    .map((specifier) => `${relative(src, file)} → ${specifier}`));
  assert.deepEqual(offenders, []);
});

test('the architecture check can fail: a framework import in domain/ would be reported', () => {
  const fake = join(src, 'domain', 'model', 'fake.ts');
  assert.deepEqual(['@nestjs/common', 'pg', '../../infrastructure/x.js'].filter((specifier) => !specifier.startsWith('.') || resolved(fake, specifier) !== 'domain'), ['@nestjs/common', 'pg', '../../infrastructure/x.js']);
});

test('REQ-11-01 · no event type code appears in the source: no switch or if on the type', async () => {
  const codes = (await readSeeds()).map((type) => type.code);
  const offenders = sources.flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return codes.filter((code) => new RegExp(`['"\`]${code}['"\`]`).test(text)).map((code) => `${relative(src, file)} mentions ${code}`);
  });
  assert.deepEqual(offenders, []);
  assert.deepEqual(sources.filter((file) => /\bswitch\s*\(/.test(readFileSync(file, 'utf8'))), []);
});

test('REQ-14-05 · no floating point for money anywhere in the code', () => {
  const offenders = sources.filter((file) => /parseFloat|toFixed\(|Number\.parseFloat|Math\.round\([^)]*minor/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders.map((file) => relative(src, file)), []);
});

const migrations = join(root, 'db', 'migrations');
const migrationFiles = readdirSync(migrations);

test('migrations are versioned and reversible: every up has a down', () => {
  const ups = migrationFiles.filter((file) => file.endsWith('.up.sql')).map((file) => file.replace('.up.sql', ''));
  assert.ok(ups.length >= 2);
  assert.deepEqual(ups.filter((name) => !migrationFiles.includes(`${name}.down.sql`)), []);
});

test('REQ-14-03 + lane 10 DoD · every table enables and forces RLS; every timestamp has a time zone', () => {
  const sql = migrationFiles.filter((file) => file.endsWith('.up.sql')).map((file) => readFileSync(join(migrations, file), 'utf8')).join('\n');
  const tables = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map((match) => match[1]);
  assert.ok(tables.includes('celebration') && tables.includes('read_public_celebration'));
  const missing = tables.filter((table) => !sql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`) || !sql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
  assert.deepEqual(missing, []);
  assert.deepEqual([...sql.matchAll(/\btimestamp\b(?!tz)(?! with time zone)/gi)].map((match) => match.index), []);
});

test('event type seeds are idempotent data files with unique codes', async () => {
  const seeds = await readSeeds();
  assert.equal(new Set(seeds.map((seed) => seed.code)).size, seeds.length);
  assert.ok(['WEDDING', 'QUINCEANERA', 'BAUTIZO'].every((code) => seeds.some((seed) => seed.code === code)));
});

test('REQ-14-04 · a server running in Europe/Madrid still shows the La Paz wall clock of the event', () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL('./fixtures/madrid-viewer.mjs', import.meta.url))], { env: { ...process.env, TZ: 'Europe/Madrid' }, encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.serverOffsetMinutes, -60, 'the child process really runs in Madrid (UTC+1 in December)');
  assert.equal(result.stored, '2026-12-20T03:30:00.000Z');
  assert.deepEqual(result.local, { date: '2026-12-19', time: '23:30', timeZone: 'America/La_Paz', utcOffset: '-04:00' });
});

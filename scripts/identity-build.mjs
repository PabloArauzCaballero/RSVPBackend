import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/identity-service/', import.meta.url));
async function javaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? javaFiles(join(directory, entry.name)) : entry.name.endsWith('.java') ? [join(directory, entry.name)] : []));
  return nested.flat();
}
const main = await javaFiles(join(root, 'src/main/java'));
const test = await javaFiles(join(root, 'src/test/java'));
const build = join(root, 'build/classes');
const compile = spawnSync('javac', ['--release', '21', '-d', build, ...main, ...test], { stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);
if (process.argv[2] === 'test') {
  const run = spawnSync('java', ['-ea', '-cp', build, 'com.rsvp.identity.IdentityServiceTest'], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
console.log(`Compiled ${main.length} identity sources and ${test.length} tests.`);

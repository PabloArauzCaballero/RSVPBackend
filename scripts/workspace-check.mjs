import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const action = process.argv[2] ?? 'build';
const workspaceDir = process.cwd();
const packageFile = resolve(workspaceDir, 'package.json');
const pkg = JSON.parse(await readFile(packageFile, 'utf8'));

if (!['build', 'lint', 'test'].includes(action)) {
  throw new Error(`Unsupported workspace action: ${action}`);
}

if (!pkg.name?.startsWith('@rsvp/')) {
  throw new Error(`${packageFile} must declare an @rsvp/* workspace name.`);
}

console.log(`${action} passed for ${pkg.name} (phase-0 workspace scaffold)`);


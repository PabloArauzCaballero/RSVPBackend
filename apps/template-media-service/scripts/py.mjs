// Runs Python with the service virtualenv when present (local), or the system interpreter (CI, Docker).
// Usage: node scripts/py.mjs <args...>   e.g. node scripts/py.mjs manage.py test tests
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const venv = process.platform === 'win32' ? join(root, '.venv', 'Scripts', 'python.exe') : join(root, '.venv', 'bin', 'python');
const candidates = existsSync(venv) ? [venv] : (process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']);
const env = { MEDIA_STORAGE_BACKEND: 'memory', LOG_LEVEL: 'ERROR', PYTHONDONTWRITEBYTECODE: '1', ...process.env };

for (const python of candidates) {
  const result = spawnSync(python, process.argv.slice(2), { cwd: root, env, stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') continue;
  process.exit(result.status ?? 1);
}
console.error('No Python interpreter found. Run: yarn workspace @rsvp/template-media-service setup');
process.exit(1);

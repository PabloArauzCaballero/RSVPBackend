// Runs the identity-service Gradle wrapper from the Yarn/Turbo pipeline.
//   build → compile and package the Spring Boot jar (no tests)
//   test  → unit, ArchUnit and Testcontainers integration tests (needs Docker)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/identity-service/', import.meta.url));
const tasks = { build: ['bootJar'], test: ['test'] };
const mode = process.argv[2] ?? 'build';
if (!tasks[mode]) {
  console.error(`Unknown mode "${mode}". Use one of: ${Object.keys(tasks).join(', ')}.`);
  process.exit(2);
}
const windows = process.platform === 'win32';
const result = spawnSync(windows ? `"${join(root, 'gradlew.bat')}"` : 'sh', [...(windows ? [] : ['./gradlew']), ...tasks[mode], '--no-daemon', '--console=plain'], { cwd: root, stdio: 'inherit', shell: windows });
process.exit(result.status ?? 1);

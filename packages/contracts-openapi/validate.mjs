import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const specsDir = fileURLToPath(new URL('./specs/', import.meta.url));
const files = (await readdir(specsDir)).filter((file) => file.endsWith('.json')).sort();
if (files.length !== 8) throw new Error(`Expected 8 OpenAPI specs, found ${files.length}.`);

for (const file of files) {
  const spec = JSON.parse(await readFile(join(specsDir, file), 'utf8'));
  if (spec.openapi !== '3.1.0') throw new Error(`${file}: OpenAPI 3.1.0 is required.`);
  if (spec.info?.version !== '1.0.0') throw new Error(`${file}: contract must be frozen at v1.0.0.`);
  if (!spec.paths || Object.keys(spec.paths).length === 0) throw new Error(`${file}: must expose at least one path.`);
  if (!spec.components?.schemas?.Problem) throw new Error(`${file}: must define RFC 9457 Problem.`);
}
console.log(`Validated ${files.length} OpenAPI 3.1 contracts at v1.0.0.`);

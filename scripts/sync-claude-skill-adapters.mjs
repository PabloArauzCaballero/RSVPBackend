import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const check = process.argv.includes('--check');
const skillRoot = join(root, '.agents/skills');
const names = readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const stale = [];

for (const name of names) {
  const canonicalPath = join(skillRoot, name, 'SKILL.md');
  const canonical = readFileSync(canonicalPath, 'utf8');
  const declaredName = canonical.match(/^name: (.+)$/m)?.[1];
  const descriptionLine = canonical.match(/^description: .+$/m)?.[0];
  if (declaredName !== name || !descriptionLine) throw new Error(`Frontmatter inválido: ${canonicalPath}`);
  const adapter = `---\nname: ${name}\n${descriptionLine}\n---\n\n# ${name}\n\nLee íntegramente la fuente canónica \`../../../.agents/skills/${name}/SKILL.md\` antes de aplicar esta skill. Si la fuente menciona referencias necesarias para la tarea, lee esos archivos desde su directorio canónico. La fuente canónica prevalece sobre este adaptador.\n`;
  const destination = join(root, '.claude/skills', name, 'SKILL.md');
  if (!existsSync(destination) || readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') !== adapter) {
    if (check) stale.push(name);
    else {
      mkdirSync(join(root, '.claude/skills', name), { recursive: true });
      writeFileSync(destination, adapter);
    }
  }
}

if (stale.length) {
  console.error(`Adaptadores Claude desactualizados: ${stale.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`${names.length} adaptadores Claude ${check ? 'verificados' : 'sincronizados'}.`);
}

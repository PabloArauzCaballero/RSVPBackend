import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2];

try {
  if (!['claude', 'gemini', 'cli'].includes(mode)) throw new Error('Modo de recarga inválido');
  const input = mode === 'cli' ? {} : JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  const event = mode === 'claude' ? 'UserPromptSubmit' : 'BeforeAgent';
  if (mode !== 'cli' && input.hook_event_name !== event) throw new Error(`Se esperaba ${event}`);

  const manifest = JSON.parse(readFileSync(join(root, 'docs/engineering/marketing-skills-source.json'), 'utf8').replace(/^\uFEFF/, ''));
  const vendorNames = new Set(manifest.skills);
  const skillRoot = join(root, '.agents/skills');
  const names = readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const name of vendorNames) if (!names.includes(name)) throw new Error(`Falta la skill vendorizada ${name}`);

  const files = names.map((name) => {
    const path = `.agents/skills/${name}/SKILL.md`;
    const content = readFileSync(join(root, path), 'utf8');
    if (!content.startsWith('---\n') || !content.includes('\n---\n')) throw new Error(`Frontmatter inválido: ${path}`);
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
    const description = content.match(/^description:\s*(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, '') ?? '';
    return { name, path, content, hash, description: description.slice(0, 140) };
  });

  const prompt = String(input.prompt ?? '');
  const selected = files.filter(({ name }) =>
    name.startsWith('rsvp-') || name === 'marketing-ideas' || name === 'product-marketing' ||
    new RegExp(`(?:\\$|/)${name}(?![\\w-])`, 'i').test(prompt),
  );
  const context = [
    '# Recarga obligatoria de skills RSVP para ESTE prompt',
    `Repositorio: ${root}`,
    'Se leyeron de disco AGENTS.md y TODOS los SKILL.md listados abajo en este prompt.',
    'Antes de actuar, lee completo desde disco cualquier skill pertinente que solo figure en el índice; lee sus referencias necesarias. Repite en cada prompt y en el otro repo si la tarea cruza ambos.',
    '\n## AGENTS.md\n' + readFileSync(join(root, 'AGENTS.md'), 'utf8'),
    '\n## Catálogo completo (nombre | sha256 corto | descripción | ruta)',
    ...files.map(({ name, hash, description, path }) => `${name} | ${hash} | ${description} | ${path}`),
    ...selected.map(({ path, content }) => `\n## Contenido íntegro: ${path}\n${content}`),
  ].join('\n');

  if (mode === 'gemini') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'BeforeAgent', additionalContext: context } }));
  } else {
    process.stdout.write(context);
  }
} catch (error) {
  process.stderr.write(`Recarga obligatoria fallida: ${error.message}\n`);
  process.exitCode = 2;
}

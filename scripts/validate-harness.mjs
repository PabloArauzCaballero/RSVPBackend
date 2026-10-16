import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const laneDir = join(root, 'docs/plan/carriles');
const lanes = readdirSync(laneDir).filter((name) => /^lane-\d{2}-.*\.md$/.test(name));
const errors = [];

for (let number = 1; number <= 36; number++) {
  const id = String(number).padStart(2, '0');
  const matches = lanes.filter((name) => name.startsWith(`lane-${id}-`));
  if (matches.length !== 1) {
    errors.push(`Carril ${id}: se esperaba una ficha; encontradas ${matches.length}`);
    continue;
  }
  const content = readFileSync(join(laneDir, matches[0]), 'utf8');
  if (!content.includes(`REQ-${id}-`)) errors.push(`${matches[0]}: faltan REQs del carril`);
  if (!content.includes('Usa $rsvp-backend-lane')) errors.push(`${matches[0]}: falta invocación de la skill`);
  if (content.includes('/rsvp-master')) errors.push(`${matches[0]}: comando histórico sin implementación`);
}
if (lanes.length !== 36) errors.push(`Se esperaban 36 carriles; encontrados ${lanes.length}`);

const manifest = JSON.parse(readFileSync(join(root, 'docs/engineering/marketing-skills-source.json'), 'utf8').replace(/^\uFEFF/, ''));
const skillNames = readdirSync(join(root, '.agents/skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (manifest.skills.length !== 50 || manifest.skills.some((name) => !skillNames.includes(name))) {
  errors.push('Catálogo de Marketing Skills incompleto');
}
for (const name of skillNames) {
  const path = `.agents/skills/${name}/SKILL.md`;
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    errors.push(`${path}: no existe`);
    continue;
  }
  const content = readFileSync(fullPath, 'utf8');
  if (!content.startsWith('---\n') || !content.includes(`name: ${name}\n`) || !/^description: .+/m.test(content)) {
    errors.push(`${path}: frontmatter incompleto`);
  }
  const claudePath = join(root, '.claude/skills', name, 'SKILL.md');
  if (!existsSync(claudePath)) {
    errors.push(`${name}: falta entrada de Claude Code`);
  } else {
    const adapter = readFileSync(claudePath, 'utf8');
    const canonicalDescription = content.match(/^description: (.+)$/m)?.[1];
    if (!adapter.includes(`name: ${name}\n`) || !adapter.includes(`description: ${canonicalDescription}\n`) || !adapter.includes(`../../../${path}`)) {
      errors.push(`${name}: entrada de Claude Code desactualizada`);
    }
  }
}
if (!skillNames.includes('rsvp-security-tenancy') || !skillNames.includes('rsvp-evidence')) errors.push('Faltan skills RSVP de seguridad o evidencia');
const adapters = spawnSync(process.execPath, ['scripts/sync-claude-skill-adapters.mjs', '--check'], { cwd: root, encoding: 'utf8' });
if (adapters.status !== 0) errors.push(adapters.stderr.trim() || 'Adaptadores Claude desactualizados');
const vendor = spawnSync(process.execPath, ['scripts/validate-marketing-vendor.mjs'], { cwd: root, encoding: 'utf8' });
if (vendor.status !== 0) errors.push(vendor.stderr.trim() || 'Marketing Skills difiere del manifiesto');
const replan = spawnSync(process.execPath, ['scripts/validate-replan.mjs'], { cwd: root, encoding: 'utf8' });
if (replan.status !== 0) errors.push(replan.stderr.trim() || 'Replanificación y CodeGraph incompletos');
for (const path of ['AGENTS.md', 'docs/engineering/convenciones.md']) {
  if (!existsSync(join(root, path))) errors.push(`${path}: no existe`);
}
for (const [path, expected] of [['CLAUDE.md', '@AGENTS.md'], ['GEMINI.md', '@./AGENTS.md']]) {
  if (!existsSync(join(root, path)) || readFileSync(join(root, path), 'utf8').trim() !== expected) {
    errors.push(`${path}: falta import de AGENTS.md`);
  }
}
const claudeSettings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
const claudeHook = claudeSettings.hooks?.UserPromptSubmit?.[0]?.hooks?.[0];
if (claudeHook?.onFailure !== 'block' || !claudeHook.args?.[0]?.includes('reload-skills.mjs')) errors.push('Hook Claude por prompt inválido');
const geminiSettings = JSON.parse(readFileSync(join(root, '.gemini/settings.json'), 'utf8'));
const geminiHook = geminiSettings.hooks?.BeforeAgent?.[0]?.hooks?.[0];
if (!geminiHook?.command?.includes('reload-skills.mjs')) errors.push('Hook Gemini por prompt inválido');
for (const [mode, event] of [['claude', 'UserPromptSubmit'], ['gemini', 'BeforeAgent']]) {
  const result = spawnSync(process.execPath, ['scripts/reload-skills.mjs', mode], {
    cwd: root, encoding: 'utf8', input: JSON.stringify({ hook_event_name: event, prompt: '$seo-audit' }), maxBuffer: 2_000_000,
  });
  if (result.status !== 0) {
    errors.push(`Recarga ${mode} falló: ${result.stderr.trim()}`);
    continue;
  }
  const content = mode === 'gemini' ? JSON.parse(result.stdout).hookSpecificOutput.additionalContext : result.stdout;
  if (!content.includes('Contenido íntegro: .agents/skills/seo-audit/SKILL.md') || !content.includes('rsvp-security-tenancy')) {
    errors.push(`Recarga ${mode}: falta el catálogo o la skill invocada`);
  }
  const rejected = spawnSync(process.execPath, ['scripts/reload-skills.mjs', mode], {
    cwd: root, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'WrongEvent', prompt: '' }),
  });
  if (rejected.status !== 2) errors.push(`Recarga ${mode}: no bloquea entrada inválida`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Harness backend: 36 carriles, ${skillNames.length} skills y recarga por prompt válidos.`);
}

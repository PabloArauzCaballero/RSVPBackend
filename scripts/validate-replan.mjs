import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const frontend = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name === 'rsvp-frontend';
const expected = frontend ? 28 : 36;
const prefix = frontend ? 'F' : '';
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');
const planPath = 'docs/plan/revision-vertical-slice-2026-10-16.md';
if (!existsSync(join(root, planPath))) errors.push(`Falta ${planPath}`);
const plan = existsSync(join(root, planPath)) ? read(planPath) : '';
const lanes = readdirSync(join(root, 'docs/plan/carriles')).filter((name) => new RegExp(`^lane-${prefix}\\d{2}-.*\\.md$`).test(name));

for (let n = 1; n <= expected; n++) {
  const id = `${prefix}${String(n).padStart(2, '0')}`;
  const file = lanes.find((name) => name.startsWith(`lane-${id}-`));
  if (!file) { errors.push(`Falta carril ${id}`); continue; }
  const content = read(`docs/plan/carriles/${file}`);
  if (!content.includes('## Primer slice vertical replanificado (16-oct-2026)') || !/\*\*Resultado demostrable:\*\* .+/.test(content)) errors.push(`${id}: falta corte observable`);
  if (!content.includes('## Inventario histórico de capacidades') || content.includes('## Plan por slices')) errors.push(`${id}: lista horizontal todavía presentada como plan`);
  if (!content.includes('**Descubrimiento:** consultar CodeGraph') || !content.includes('**REQs:** relacionar')) errors.push(`${id}: faltan grafo o trazabilidad`);
  if (!plan.includes(`| [${id}](carriles/${file}) |`)) errors.push(`${id}: no figura en la revisión`);
}
if (lanes.length !== expected) errors.push(`Se esperaban ${expected} carriles; encontrados ${lanes.length}`);

const requiredSkills = ['rsvp-vertical-slice', 'rsvp-code-graph', 'impeccable', 'ui-ux-pro-max'];
for (const name of requiredSkills) if (!existsSync(join(root, `.agents/skills/${name}/SKILL.md`))) errors.push(`Falta skill ${name}`);
for (const name of ['impeccable', 'ui-ux-pro-max']) if (!existsSync(join(root, `.agents/skills/${name}/LICENSE`))) errors.push(`Falta licencia de ${name}`);
if (!existsSync(join(root, 'docs/engineering/skill-sources-2026-10-16.json'))) errors.push('Falta procedencia de skills');
if (read('.agents/skills/ui-ux-pro-max/SKILL.md').includes('${CLAUDE_PLUGIN_ROOT}')) errors.push('UI/UX Pro Max conserva ruta exclusiva de Claude');
if (read('.agents/skills/impeccable/SKILL.md').includes('${CLAUDE_SKILL_DIR}')) errors.push('Impeccable conserva ruta exclusiva de Claude');
const agentRules = read('AGENTS.md');
for (const name of requiredSkills) if (!agentRules.includes(name)) errors.push(`AGENTS.md no obliga ${name}`);
if (!agentRules.includes('recarga en CADA prompt')) errors.push('Falta recarga obligatoria por prompt');
if (frontend && !agentRules.includes('rsvp-motion-design')) errors.push('Falta motion design obligatorio');
if (!read('docs/plan/README.md').includes('revision-vertical-slice-2026-10-16.md')) errors.push('README del plan sin revisión vigente');

const pkg = JSON.parse(read('package.json'));
if (pkg.devDependencies?.['@colbymchenry/codegraph'] !== '1.6.2') errors.push('CodeGraph debe estar fijado en 1.6.2');
if (pkg.scripts?.['graph:init'] !== 'codegraph init --yes') errors.push('Falta graph:init');
if (!read('.gitignore').includes('.codegraph/')) errors.push('El índice local debe estar ignorado');
if (!existsSync(join(root, 'codegraph.json'))) errors.push('Falta exclusión de vendored skills');
const claude = JSON.parse(read('.mcp.json'));
const gemini = JSON.parse(read('.gemini/settings.json'));
const codex = read('.codex/config.toml');
for (const [agent, config] of [['Claude', claude.mcpServers?.codegraph], ['Gemini', gemini.mcpServers?.codegraph]]) {
  if (config?.command !== 'node' || config?.args?.[0] !== 'node_modules/@colbymchenry/codegraph/npm-shim.js' || !config?.args?.includes('--mcp')) errors.push(`${agent} sin MCP CodeGraph ejecutable en Windows`);
}
if (!codex.includes('[mcp_servers.codegraph]') || !codex.includes('command = "node"') || !codex.includes('npm-shim.js') || !codex.includes('--mcp')) errors.push('Codex sin MCP CodeGraph ejecutable en Windows');

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Replanificación ${frontend ? 'frontend' : 'backend'}: ${expected} carriles, 4 skills y CodeGraph para los 3 agentes válidos.`);
}

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'docs/engineering/marketing-skills-source.json'), 'utf8').replace(/^\uFEFF/, ''));
const skillRoot = join(root, '.agents/skills');
const files = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Entrada no admitida: ${path}`);
  }
}

for (const name of manifest.skills) visit(join(skillRoot, name));
const digest = createHash('sha256');
for (const path of files.sort()) {
  const name = relative(skillRoot, path).split(sep).join('/');
  const fileHash = createHash('sha256').update(readFileSync(path)).digest('hex');
  digest.update(`${name}\0${fileHash}\n`);
}
const actual = { fileCount: files.length, contentSha256: digest.digest('hex') };

if (process.argv.includes('--print')) {
  console.log(JSON.stringify(actual, null, 2));
} else if (actual.fileCount !== manifest.fileCount || actual.contentSha256 !== manifest.contentSha256) {
  console.error(`Marketing Skills difiere del manifiesto: ${JSON.stringify(actual)}`);
  process.exitCode = 1;
} else {
  console.log(`${manifest.skills.length} skills de marketing y ${actual.fileCount} archivos íntegros.`);
}

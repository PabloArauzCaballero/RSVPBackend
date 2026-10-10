import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('./asyncapi.yaml', import.meta.url), 'utf8'));
if (catalog.asyncapi !== '2.6.0') throw new Error('AsyncAPI 2.6.0 is required.');
if (catalog.info?.version !== '1.0.0') throw new Error('Event catalog must be frozen at v1.0.0.');
const channels = Object.keys(catalog.channels ?? {});
if (channels.length < 40) throw new Error(`Expected the complete initial catalog (>=40 events); found ${channels.length}.`);
for (const channel of channels) {
  if (!/^[a-z]+\.[a-z-]+\.[a-z-]+\.v1$/.test(channel)) throw new Error(`Invalid routing key: ${channel}`);
}
console.log(`Validated ${channels.length} AsyncAPI event contracts at v1.0.0.`);


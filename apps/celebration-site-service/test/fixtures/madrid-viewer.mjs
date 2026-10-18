// Runs in a child process with TZ=Europe/Madrid: a server and a visitor far from the event.
import { randomUUID } from 'node:crypto';
import { buildRuntime, createCelebration, publishCelebration, getPublicCelebration, readSeeds } from '../../dist/index.js';

const seeds = (await readSeeds()).filter((type) => type.code === 'WEDDING');
const runtime = await buildRuntime({ seeds, authenticator: { authenticate: async () => { throw new Error('unused'); } } });
const request = { actor: { userId: randomUUID(), roles: [], organizationIds: [] }, correlationId: randomUUID() };
const created = await createCelebration(runtime.app, request, {
  slug: 'boda-medianoche', eventTypeCode: 'WEDDING', timeZone: 'America/La_Paz',
  content: { title: 'Boda', eventDate: '2026-12-19T23:30', venueName: 'Salón', hosts: { BRIDE: 'Ana', GROOM: 'Luis' } }
});
await publishCelebration(runtime.app, request, { celebrationId: created.id, expectedVersion: created.version });
await new Promise((resolve) => setTimeout(resolve, 20));
const view = await getPublicCelebration(runtime.publicStore, 'boda-medianoche', 'es-BO');
process.stdout.write(JSON.stringify({ serverOffsetMinutes: new Date('2026-12-19T12:00:00Z').getTimezoneOffset(), stored: created.content.eventDate, local: view.localTimes.eventDate }));
await runtime.close();

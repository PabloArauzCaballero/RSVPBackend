import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { defineEventType, type EventTypeDefinition } from '../../domain/model/event-type-definition.js';
import { SYSTEM_USER } from '../../application/command/admin-reference-data.js';
import type { UnitOfWork } from '../../application/ports.js';

/**
 * Event types live in versioned JSON seeds (db/seeds/event-types). Seeding is an
 * idempotent upsert: running it twice changes nothing, and a new file is a new
 * type without touching or redeploying code.
 */

export const SEEDS_DIR = fileURLToPath(new URL('../../../db/seeds/event-types/', import.meta.url));
const JSON_SUFFIX = '.json';

export async function readSeedFile(path: string): Promise<EventTypeDefinition> {
  // Seed files are validated by defineEventType before anything is written.
  return defineEventType(JSON.parse(await readFile(path, 'utf8')) as EventTypeDefinition);
}

export async function readSeeds(directory = SEEDS_DIR): Promise<EventTypeDefinition[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(JSON_SUFFIX)).sort();
  return Promise.all(files.map(async (file) => readSeedFile(join(directory, file))));
}

const SEED_SCOPE = { userId: SYSTEM_USER, organizationIds: [], admin: true } as const;

/** Upserts definitions; returns the codes that were new. */
export async function seedEventTypes(uow: UnitOfWork, definitions: readonly EventTypeDefinition[]): Promise<string[]> {
  return uow.run(SEED_SCOPE, async (tx) => {
    const created = await definitions.reduce<Promise<string[]>>(async (accumulated, definition) => {
      const codes = await accumulated;
      return (await tx.eventTypes.upsert(definition)) ? [...codes, definition.code] : codes;
    }, Promise.resolve([]));
    return created;
  });
}

import type { EventTypeDefinition } from '../model/event-type-definition.js';

/**
 * Publish requirements come from the event type (lane 13), never from code:
 * a wedding and a quinceañera demand different fields because their rows say so.
 */

const PATH_SEPARATOR = '.';

function valueAt(content: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split(PATH_SEPARATOR).reduce<unknown>((node, key) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Readonly<Record<string, unknown>>)[key];
  }, content);
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return !value.length;
  if (typeof value === 'object') return !Object.keys(value).length;
  return false;
}

/** Exactly the required paths that are still empty, in the order the type declares them. */
export function missingFieldsForPublish(content: Readonly<Record<string, unknown>>, type: EventTypeDefinition): string[] {
  return type.requiredFieldsForPublish.filter((path) => isBlank(valueAt(content, path)));
}

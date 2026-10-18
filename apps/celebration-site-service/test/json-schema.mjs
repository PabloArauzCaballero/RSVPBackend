import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Just enough JSON Schema to check our envelopes against the AsyncAPI catalog, with exact error paths. */
export const asyncapi = JSON.parse(readFileSync(fileURLToPath(new URL('../../../packages/contracts-asyncapi/asyncapi.yaml', import.meta.url)), 'utf8'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const typeOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value);
const resolve = (ref) => ref.replace('#/', '').split('/').reduce((node, key) => node[key], asyncapi);

export function validate(schema, value, path = '$') {
  if (schema.$ref) return validate(resolve(schema.$ref), value, path);
  const errors = [];
  for (const part of schema.allOf ?? []) errors.push(...validate(part, value, path));
  if (schema.type) {
    const allowed = [schema.type].flat();
    const actual = typeOf(value);
    if (!allowed.includes(actual) && !(actual === 'integer' && allowed.includes('number'))) return [...errors, `${path}: expected ${allowed.join('|')}, got ${actual}`];
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path}: expected const ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in ${schema.enum.join(',')}`);
  if (typeof value === 'string') {
    if (schema.format === 'uuid' && !UUID.test(value)) errors.push(`${path}: not a uuid`);
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) errors.push(`${path}: not a date-time`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below ${schema.minimum}`);
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => errors.push(...validate(schema.items, item, `${path}[${index}]`)));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: required`);
    for (const [key, nested] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validate(schema.properties[key], nested, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
      else if (typeof schema.additionalProperties === 'object') errors.push(...validate(schema.additionalProperties, nested, `${path}.${key}`));
    }
  }
  return errors;
}

/** Validates an envelope against the message of its own channel. */
export function validateEvent(envelope) {
  const channel = asyncapi.channels[envelope.eventType];
  if (!channel) return [`unknown channel ${envelope.eventType}`];
  const message = resolve(channel.publish.message.$ref);
  return validate(message.payload, envelope);
}

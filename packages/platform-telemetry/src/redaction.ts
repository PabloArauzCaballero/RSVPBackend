const SENSITIVE_KEY = /email|e-mail|phone|telefono|teléfono|password|secret|token|authorization/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(nested)]));
  return value;
}

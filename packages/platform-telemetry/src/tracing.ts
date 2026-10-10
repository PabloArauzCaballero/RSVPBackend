export interface TraceContext { traceId: string; spanId: string; correlationId: string; parentSpanId?: string; }
export interface RecordedSpan extends TraceContext { name: string; startedAt: number; endedAt?: number; attributes: Record<string, string | number | boolean>; }

function randomHex(length: number): string {
  let value = '';
  while (value.length < length) value += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return value.slice(0, length);
}

export function createTraceContext(correlationId: string, parent?: TraceContext): TraceContext {
  return { traceId: parent?.traceId ?? randomHex(32), spanId: randomHex(16), correlationId, parentSpanId: parent?.spanId };
}

export function toTraceHeaders(context: TraceContext): Record<string, string> {
  return { correlationId: context.correlationId, traceparent: `00-${context.traceId}-${context.spanId}-01` };
}

export function fromTraceHeaders(headers: Record<string, string | undefined>): TraceContext {
  const values = headers.traceparent?.split('-');
  if (!values || values.length !== 4 || !headers.correlationId) throw new Error('Missing or invalid trace headers.');
  return { traceId: values[1], spanId: values[2], correlationId: headers.correlationId };
}

export class InMemoryTracer {
  readonly spans: RecordedSpan[] = [];
  startSpan(name: string, correlationId: string, parent?: TraceContext, attributes: Record<string, string | number | boolean> = {}): { context: TraceContext; end: () => void } {
    const context = createTraceContext(correlationId, parent);
    const span: RecordedSpan = { ...context, name, startedAt: Date.now(), attributes };
    this.spans.push(span);
    return { context, end: () => { span.endedAt = Date.now(); } };
  }
}

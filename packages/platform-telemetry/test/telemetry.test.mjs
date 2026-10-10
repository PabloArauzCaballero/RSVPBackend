import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryTracer, JsonLogger, MetricsRegistry, fromTraceHeaders, parkingQueueAlert, toTraceHeaders } from '../dist/index.js';

test('propagates one trace and correlation id across an event boundary', () => {
  const tracer = new InMemoryTracer();
  const http = tracer.startSpan('HTTP POST /rsvps', 'corr-1');
  const broker = fromTraceHeaders(toTraceHeaders(http.context));
  const consumer = tracer.startSpan('broker consume', broker.correlationId, broker);
  http.end(); consumer.end();
  assert.equal(consumer.context.traceId, http.context.traceId);
  assert.equal(consumer.context.correlationId, 'corr-1');
});

test('redacts PII at serialization rather than trusting each caller', () => {
  const lines = [];
  new JsonLogger({ write: (line) => lines.push(line) }).log({ level: 'info', message: 'sent', email: 'person@example.com', nested: { phone: '+59170000000' } });
  assert.match(lines[0], /REDACTED/);
  assert.doesNotMatch(lines[0], /person@example.com|70000000/);
});

test('exposes outbox and parking metrics and raises a parking alert', () => {
  const metrics = new MetricsRegistry();
  metrics.setOutboxLag(42); metrics.setParkingQueueDepth(1); metrics.recordLead();
  assert.equal(parkingQueueAlert(metrics), true);
  assert.match(metrics.renderPrometheus(), /rsvp_outbox_lag_seconds 42/);
});

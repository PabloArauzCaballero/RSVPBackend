import { redact } from './redaction.js';

export interface StructuredLog { level: 'debug' | 'info' | 'warn' | 'error'; message: string; correlationId?: string; [field: string]: unknown; }
export interface LogSink { write(line: string): void; }

export class JsonLogger {
  constructor(private readonly sink: LogSink) {}
  log(entry: StructuredLog): void { this.sink.write(JSON.stringify(redact(entry))); }
}

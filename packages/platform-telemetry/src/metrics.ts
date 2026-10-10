export class MetricsRegistry {
  private readonly values = new Map<string, number>();
  set(name: string, value: number): void { this.values.set(name, value); }
  increment(name: string, delta = 1): void { this.set(name, (this.values.get(name) ?? 0) + delta); }
  get(name: string): number { return this.values.get(name) ?? 0; }
  renderPrometheus(): string { return [...this.values.entries()].map(([name, value]) => `${name} ${value}`).join('\n') + (this.values.size ? '\n' : ''); }
  setOutboxLag(seconds: number): void { this.set('rsvp_outbox_lag_seconds', seconds); }
  setParkingQueueDepth(depth: number): void { this.set('rsvp_parking_queue_depth', depth); }
  recordLead(): void { this.increment('rsvp_leads_total'); }
}

export function parkingQueueAlert(metrics: MetricsRegistry): boolean { return metrics.get('rsvp_parking_queue_depth') > 0; }

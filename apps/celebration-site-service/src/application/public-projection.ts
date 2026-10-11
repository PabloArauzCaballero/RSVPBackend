import type { Celebration } from '../domain/celebration.js';
import type { DomainEvent } from './service.js';
import { translated } from '../domain/translations.js';
export interface PublicCelebration { slug: string; eventDate?: unknown; title?: unknown; locale: string; content: Record<string, unknown>; projectionVersion: number }
export class PublicCelebrationProjection {
  private rows = new Map<string, PublicCelebration>();
  apply(celebration: Celebration, domainEvent: DomainEvent, locale: string): void { if (domainEvent.eventType === 'celebration.celebration.published.v1') this.rows.set(celebration.slug, { slug: celebration.slug, eventDate: celebration.content.eventDate, title: translated(celebration.translations, locale, celebration.defaultLocale).title ?? celebration.content.title, locale, content: { ...celebration.content, ...translated(celebration.translations, locale, celebration.defaultLocale) }, projectionVersion: celebration.version }); if (celebration.status !== 'PUBLISHED') this.rows.delete(celebration.slug); }
  get(slug: string): PublicCelebration | undefined { return this.rows.get(slug); }
  clear(): void { this.rows.clear(); }
  replay(events: DomainEvent[], celebrations: Celebration[], locale: string): void { this.clear(); for (const domainEvent of events) { const celebration = celebrations.find((item) => item.id === domainEvent.tenant.celebrationId); if (celebration) this.apply(celebration, domainEvent, locale); } }
}

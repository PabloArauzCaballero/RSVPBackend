import type { EventTypeDefinition } from '../model/event-type-definition.js';

/** Event types are rows: adding one is an insert, never a deploy (lane 11). */
export interface EventTypeRepository {
  get(code: string): Promise<EventTypeDefinition | undefined>;
  list(): Promise<readonly EventTypeDefinition[]>;
  /** Insert or replace; returns true when the row did not exist. */
  upsert(definition: EventTypeDefinition): Promise<boolean>;
}

export const TemplateStatus = { Draft: 'DRAFT', Published: 'PUBLISHED', Archived: 'ARCHIVED' } as const;
export type TemplateStatus = (typeof TemplateStatus)[keyof typeof TemplateStatus];

/** Local copy of the Template/Media catalog, kept current by its events. */
export interface TemplateReference {
  readonly templateId: string;
  readonly tags: readonly string[];
  readonly status: TemplateStatus;
}

export interface TemplateCatalog {
  get(templateId: string): Promise<TemplateReference | undefined>;
  upsert(reference: TemplateReference): Promise<void>;
}

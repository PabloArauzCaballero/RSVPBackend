import { ConflictError } from '../../../domain/errors.js';
import type { EventEnvelope } from '../../../domain/event/envelope.js';
import { Celebration, type CelebrationState } from '../../../domain/model/celebration.js';
import type { CelebrationSettings } from '../../../domain/model/celebration-settings.js';
import { defineEventType, type EventTypeDefinition, type EventTypeStatus, type EventTypeTranslation, type SectionId } from '../../../domain/model/event-type-definition.js';
import type { AccessScope, Collaborator } from '../../../domain/policy/access.js';
import type { CelebrationRepository, Page } from '../../../domain/port/celebration-repository.js';
import type { EventTypeRepository, TemplateCatalog, TemplateReference, TemplateStatus } from '../../../domain/port/reference-data.js';
import type { CelebrationStatus } from '../../../domain/event/celebration-events.js';
import type { AuditEntry, AuditLog, OutboxWriter, TransactionContext, UnitOfWork } from '../../../application/ports.js';
import { inTransaction, scopeSettings, type Client, type Pool } from './pg-database.js';

interface CelebrationRow {
  readonly id: string; readonly slug: string; readonly owner_id: string; readonly organization_id: string | null;
  readonly event_type_code: string; readonly status: CelebrationStatus; readonly version: number; readonly default_locale: string;
  readonly supported_locales: string[]; readonly time_zone: string; readonly currency: string; readonly content: Record<string, unknown>;
  readonly settings: CelebrationSettings; readonly template_id: string | null; readonly collaborators: Collaborator[];
  readonly published_at: string | null; readonly created_at: string; readonly updated_at: string; readonly translations: Record<string, Record<string, unknown>>;
}

const SELECT_CELEBRATION = `SELECT c.*, COALESCE((SELECT jsonb_object_agg(t.locale, t.content) FROM celebration_translations t WHERE t.celebration_id = c.id), '{}'::jsonb) AS translations FROM celebration c`;

function toState(row: CelebrationRow): CelebrationState {
  return {
    id: row.id, slug: row.slug, ownerId: row.owner_id, organizationId: row.organization_id, eventTypeCode: row.event_type_code,
    status: row.status, version: row.version, defaultLocale: row.default_locale, supportedLocales: row.supported_locales,
    timeZone: row.time_zone, currency: row.currency.trim(), content: row.content, translations: row.translations, settings: row.settings,
    templateId: row.template_id, collaborators: row.collaborators, publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

const writeColumns = (s: CelebrationState): unknown[] => [
  s.id, s.slug, s.ownerId, s.organizationId, s.eventTypeCode, s.status, s.version, s.defaultLocale, s.supportedLocales, s.timeZone,
  s.currency, JSON.stringify(s.content), JSON.stringify(s.settings), s.templateId, JSON.stringify(s.collaborators),
  s.collaborators.map((collaborator) => collaborator.userId), s.publishedAt, s.createdAt, s.updatedAt
];

class PgCelebrationRepository implements CelebrationRepository {
  constructor(private readonly client: Client) {}

  async findById(_scope: AccessScope, celebrationId: string): Promise<Celebration | undefined> {
    // The scope is enforced by Row Level Security from the transaction settings.
    const result = await this.client.query<CelebrationRow>(`${SELECT_CELEBRATION} WHERE c.id = $1`, [celebrationId]);
    const row = result.rows[0];
    return row ? Celebration.rehydrate(toState(row)) : undefined;
  }

  async list(_scope: AccessScope, page: Page): Promise<readonly Celebration[]> {
    const result = await this.client.query<CelebrationRow>(`${SELECT_CELEBRATION} ORDER BY c.created_at DESC, c.id LIMIT $1 OFFSET $2`, [page.limit, page.offset]);
    return result.rows.map((row) => Celebration.rehydrate(toState(row)));
  }

  async insert(celebration: Celebration): Promise<void> {
    await this.client.query(
      `INSERT INTO celebration (id, slug, owner_id, organization_id, event_type_code, status, version, default_locale, supported_locales, time_zone,
        currency, content, settings, template_id, collaborators, collaborator_user_ids, published_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16::uuid[],$17,$18,$19)`,
      writeColumns(celebration.state)
    );
    await this.writeTranslations(celebration.state);
  }

  async update(celebration: Celebration): Promise<void> {
    const result = await this.client.query(
      `UPDATE celebration SET slug=$2, owner_id=$3, organization_id=$4, event_type_code=$5, status=$6, version=$7, default_locale=$8,
        supported_locales=$9, time_zone=$10, currency=$11, content=$12::jsonb, settings=$13::jsonb, template_id=$14, collaborators=$15::jsonb,
        collaborator_user_ids=$16::uuid[], published_at=$17, created_at=$18, updated_at=$19
       WHERE id = $1 AND version = $20`,
      [...writeColumns(celebration.state), celebration.loadedVersion]
    );
    if (!result.rowCount) throw new ConflictError('VERSION_CONFLICT', 'Celebration was changed by someone else; reload and retry');
    await this.writeTranslations(celebration.state);
  }

  private async writeTranslations(state: CelebrationState): Promise<void> {
    await this.client.query('DELETE FROM celebration_translations WHERE celebration_id = $1 AND NOT (locale = ANY ($2::text[]))', [state.id, Object.keys(state.translations)]);
    await this.client.query(
      `INSERT INTO celebration_translations (celebration_id, locale, content)
       SELECT $1, entry.key, entry.value FROM jsonb_each($2::jsonb) AS entry
       ON CONFLICT (celebration_id, locale) DO UPDATE SET content = EXCLUDED.content`,
      [state.id, JSON.stringify(state.translations)]
    );
  }
}

interface EventTypeRow {
  readonly code: string; readonly status: EventTypeStatus; readonly default_locale: string; readonly host_roles: string[];
  readonly enabled_sections: SectionId[]; readonly required_fields_for_publish: string[]; readonly compatible_template_tags: string[];
  readonly translations: EventTypeTranslation[];
}

const SELECT_EVENT_TYPE = `SELECT d.*, COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('locale', t.locale, 'name', t.name, 'description', t.description, 'hostRoleLabels', t.host_role_labels)) ORDER BY t.locale)
  FROM event_type_translations t WHERE t.event_type_code = d.code), '[]'::jsonb) AS translations FROM event_type_definition d`;

const toDefinition = (row: EventTypeRow): EventTypeDefinition => defineEventType({
  code: row.code, status: row.status, defaultLocale: row.default_locale, hostRoles: row.host_roles, enabledSections: row.enabled_sections,
  requiredFieldsForPublish: row.required_fields_for_publish, compatibleTemplateTags: row.compatible_template_tags, translations: row.translations
});

class PgEventTypes implements EventTypeRepository {
  constructor(private readonly client: Client) {}
  async get(code: string): Promise<EventTypeDefinition | undefined> {
    const result = await this.client.query<EventTypeRow>(`${SELECT_EVENT_TYPE} WHERE d.code = $1`, [code]);
    const row = result.rows[0];
    return row ? toDefinition(row) : undefined;
  }
  async list(): Promise<readonly EventTypeDefinition[]> {
    const result = await this.client.query<EventTypeRow>(`${SELECT_EVENT_TYPE} ORDER BY d.code`);
    return result.rows.map(toDefinition);
  }
  async upsert(d: EventTypeDefinition): Promise<boolean> {
    const result = await this.client.query<{ readonly inserted: boolean }>(
      `INSERT INTO event_type_definition (code, status, default_locale, host_roles, enabled_sections, required_fields_for_publish, compatible_template_tags, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (code) DO UPDATE SET status=EXCLUDED.status, default_locale=EXCLUDED.default_locale, host_roles=EXCLUDED.host_roles,
         enabled_sections=EXCLUDED.enabled_sections, required_fields_for_publish=EXCLUDED.required_fields_for_publish,
         compatible_template_tags=EXCLUDED.compatible_template_tags, updated_at=now()
       RETURNING (xmax = 0) AS inserted`,
      [d.code, d.status, d.defaultLocale, d.hostRoles, d.enabledSections, d.requiredFieldsForPublish, d.compatibleTemplateTags]
    );
    await this.client.query('DELETE FROM event_type_translations WHERE event_type_code = $1', [d.code]);
    await this.client.query(
      `INSERT INTO event_type_translations (event_type_code, locale, name, description, host_role_labels)
       SELECT $1, t->>'locale', t->>'name', t->>'description', COALESCE(t->'hostRoleLabels', '{}'::jsonb) FROM jsonb_array_elements($2::jsonb) AS t`,
      [d.code, JSON.stringify(d.translations)]
    );
    return Boolean(result.rows[0]?.inserted);
  }
}

class PgTemplates implements TemplateCatalog {
  constructor(private readonly client: Client) {}
  async get(templateId: string): Promise<TemplateReference | undefined> {
    const result = await this.client.query<{ readonly template_id: string; readonly tags: string[]; readonly status: TemplateStatus }>(
      'SELECT template_id, tags, status FROM template_reference WHERE template_id = $1', [templateId]
    );
    const row = result.rows[0];
    return row ? { templateId: row.template_id, tags: row.tags, status: row.status } : undefined;
  }
  async upsert(reference: TemplateReference): Promise<void> {
    await this.client.query(
      `INSERT INTO template_reference (template_id, tags, status, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (template_id) DO UPDATE SET tags = EXCLUDED.tags, status = EXCLUDED.status, updated_at = now()`,
      [reference.templateId, reference.tags, reference.status]
    );
  }
}

const AGGREGATE_TYPE = 'Celebration';

class PgOutbox implements OutboxWriter {
  constructor(private readonly client: Client) {}
  async append(envelope: EventEnvelope): Promise<void> {
    await this.client.query(
      `INSERT INTO outbox_event (id, aggregate_type, aggregate_id, event_name, payload, correlation_id, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [envelope.eventId, AGGREGATE_TYPE, envelope.tenant.celebrationId, envelope.eventType, JSON.stringify(envelope), envelope.correlationId, envelope.tenant.celebrationId, envelope.occurredAt]
    );
  }
}

class PgAudit implements AuditLog {
  constructor(private readonly client: Client) {}
  async append(entry: AuditEntry): Promise<void> {
    await this.client.query(
      'INSERT INTO celebration_audit (id, celebration_id, action, actor_id, at, event_id, details) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',
      [entry.id, entry.celebrationId, entry.action, entry.actorId, entry.at, entry.eventId, JSON.stringify(entry.details)]
    );
  }
  async list(celebrationId: string): Promise<readonly AuditEntry[]> {
    const result = await this.client.query<{ readonly id: string; readonly celebration_id: string; readonly action: string; readonly actor_id: string | null; readonly at: string; readonly event_id: string; readonly details: Record<string, unknown> }>(
      'SELECT * FROM celebration_audit WHERE celebration_id = $1 ORDER BY at, id', [celebrationId]
    );
    return result.rows.map((row) => ({ id: row.id, celebrationId: row.celebration_id, action: row.action, actorId: row.actor_id, at: row.at, eventId: row.event_id, details: row.details }));
  }
}

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}
  async run<TResult>(scope: AccessScope, work: (tx: TransactionContext) => Promise<TResult>): Promise<TResult> {
    return inTransaction(this.pool, scopeSettings(scope), async (client) => work({
      celebrations: new PgCelebrationRepository(client), eventTypes: new PgEventTypes(client), templates: new PgTemplates(client),
      outbox: new PgOutbox(client), audit: new PgAudit(client)
    }));
  }
}

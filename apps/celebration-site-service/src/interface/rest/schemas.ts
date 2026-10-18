import { z } from 'zod';
import { APPROVAL_SWITCHES, ApprovalMode } from '../../domain/model/celebration-settings.js';
import { CollaboratorRole } from '../../domain/policy/access.js';
import { EventTypeStatus, KNOWN_SECTIONS } from '../../domain/model/event-type-definition.js';

/**
 * Request schemas. They check shape only (400 on failure); business rules stay
 * in the domain (422). Strict objects reject unknown keys so typos never pass silently.
 */

const MAX_TEXT = 500;
const MAX_IDENTIFIER = 120;
const MAX_LOCALES = 20;

const content = z.record(z.string(), z.unknown());
const mode = z.enum([ApprovalMode.AutoAccept, ApprovalMode.Restricted]);

export const createCelebrationBody = z.strictObject({
  slug: z.string().max(MAX_IDENTIFIER),
  eventTypeCode: z.string().max(MAX_IDENTIFIER),
  organizationId: z.uuid().nullable().optional(),
  defaultLocale: z.string().max(MAX_IDENTIFIER).optional(),
  supportedLocales: z.array(z.string().max(MAX_IDENTIFIER)).max(MAX_LOCALES).optional(),
  timeZone: z.string().max(MAX_IDENTIFIER).optional(),
  currency: z.string().max(MAX_IDENTIFIER).optional(),
  content: content.optional(),
  translations: z.record(z.string(), content).optional()
});

export const editCelebrationBody = z.strictObject({
  slug: z.string().max(MAX_IDENTIFIER).optional(),
  defaultLocale: z.string().max(MAX_IDENTIFIER).optional(),
  supportedLocales: z.array(z.string().max(MAX_IDENTIFIER)).max(MAX_LOCALES).optional(),
  timeZone: z.string().max(MAX_IDENTIFIER).optional(),
  currency: z.string().max(MAX_IDENTIFIER).optional(),
  content: content.optional(),
  translations: z.record(z.string(), content.nullable()).optional()
}).refine((body) => Object.keys(body).length, { message: 'Send at least one field to change' });

const settingsShape = Object.fromEntries(APPROVAL_SWITCHES.map((key) => [key, mode.optional()])) as Record<(typeof APPROVAL_SWITCHES)[number], z.ZodOptional<typeof mode>>;

export const settingsBody = z.strictObject({
  ...settingsShape,
  rsvpDeadline: z.string().max(MAX_IDENTIFIER).nullable().optional(),
  partnerPriorityEnabled: z.boolean().optional()
}).refine((body) => Object.keys(body).length, { message: 'Send at least one setting to change' });

export const eventTypeBody = z.strictObject({ eventTypeCode: z.string().max(MAX_IDENTIFIER) });
export const templateBody = z.strictObject({ templateId: z.uuid() });
export const collaboratorBody = z.strictObject({ role: z.enum([CollaboratorRole.CoHost, CollaboratorRole.Viewer]) });
export const unpublishBody = z.strictObject({ reason: z.string().max(MAX_TEXT).nullable().optional() });

export const eventTypeDefinitionBody = z.strictObject({
  status: z.enum([EventTypeStatus.Active, EventTypeStatus.Retired]),
  defaultLocale: z.string().max(MAX_IDENTIFIER),
  hostRoles: z.array(z.string().max(MAX_IDENTIFIER)).min(1),
  enabledSections: z.array(z.enum(KNOWN_SECTIONS)).min(1),
  requiredFieldsForPublish: z.array(z.string().max(MAX_IDENTIFIER)),
  compatibleTemplateTags: z.array(z.string().max(MAX_IDENTIFIER)).min(1),
  translations: z.array(z.strictObject({
    locale: z.string().max(MAX_IDENTIFIER),
    name: z.string().max(MAX_IDENTIFIER),
    description: z.string().max(MAX_TEXT).optional(),
    hostRoleLabels: z.record(z.string(), z.string().max(MAX_IDENTIFIER)).optional()
  })).min(1)
});

import { upsertEventType } from '../../application/command/admin-reference-data.js';
import { createCelebration } from '../../application/command/create-celebration.js';
import { assignEventType, editCelebration, setCollaborator } from '../../application/command/edit-celebration.js';
import { archiveCelebration, publishCelebration, unpublishCelebration } from '../../application/command/publish-celebration.js';
import { selectTemplate } from '../../application/command/select-template.js';
import { updateSettings } from '../../application/command/update-settings.js';
import { getAuditLog, getCelebration, listCelebrations, publishCheck } from '../../application/query/get-celebration.js';
import { getEventType, listEventTypeDefinitions, listEventTypes } from '../../application/query/get-event-types.js';
import { getPublicCelebration } from '../../application/query/get-public-celebration.js';
import { ForbiddenError } from '../../domain/errors.js';
import type { CelebrationState } from '../../domain/model/celebration.js';
import type { SettingsPatch } from '../../domain/model/celebration-settings.js';
import { isAdmin } from '../../domain/policy/access.js';
import { HttpStatus, type Reply, type Route, type RouteContext } from './http-server.js';
import {
  collaboratorBody, createCelebrationBody, editCelebrationBody, eventTypeBody, eventTypeDefinitionBody,
  settingsBody, templateBody, unpublishBody
} from './schemas.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';
const BASE = '/celebrations';

const etag = (version: number): string => `"${version}"`;

const withVersion = (state: CelebrationState, status: number = HttpStatus.Ok): Reply => ({ status, body: state, headers: { etag: etag(state.version) } });

function page(context: RouteContext): { readonly limit: number; readonly offset: number } {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(context.query.get('limit') ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
  const offset = Math.max(0, Number(context.query.get('offset') ?? 0) || 0);
  return { limit, offset };
}

const celebrationId = (context: RouteContext): string => context.params['celebrationId'] ?? '';

const mutation = (context: RouteContext): { readonly celebrationId: string; readonly expectedVersion: number } => ({
  celebrationId: celebrationId(context), expectedVersion: context.expectedVersion()
});

export function routes(): readonly Route[] {
  return [
    { method: 'GET', path: `${BASE}/health`, handle: async () => ({ status: HttpStatus.Ok, body: { status: 'ok' } }) },
    {
      method: 'GET', path: `${BASE}/ready`, handle: async (context) => {
        const ready = await context.deps.ready();
        return { status: ready ? HttpStatus.Ok : HttpStatus.Internal, body: { status: ready ? 'ready' : 'not-ready' } };
      }
    },
    {
      method: 'GET', path: `${BASE}/event-types`,
      handle: async (context) => ({ status: HttpStatus.Ok, body: { items: await listEventTypes(context.deps.app, context.acceptLanguage) }, headers: { vary: 'accept-language' } })
    },
    {
      method: 'GET', path: `${BASE}/event-types/:code`,
      handle: async (context) => ({ status: HttpStatus.Ok, body: await getEventType(context.deps.app, context.params['code'] ?? '', context.acceptLanguage), headers: { vary: 'accept-language' } })
    },
    {
      method: 'GET', path: `${BASE}/admin/event-types`,
      handle: async (context) => ({ status: HttpStatus.Ok, body: { items: await listEventTypeDefinitions(context.deps.app, await context.request()) } })
    },
    {
      method: 'PUT', path: `${BASE}/admin/event-types/:code`, handle: async (context) => {
        const request = await context.request();
        const body = await context.body(eventTypeDefinitionBody);
        const result = await upsertEventType(context.deps.app, request, { ...body, code: context.params['code'] ?? '' });
        return { status: result.created ? HttpStatus.Created : HttpStatus.Ok, body: result.definition };
      }
    },
    {
      method: 'POST', path: `${BASE}/admin/projections/public/replay`, handle: async (context) => {
        if (!isAdmin(await context.actor())) throw new ForbiddenError('Only platform administrators can rebuild projections');
        const applied = await context.deps.projector.replay(context.deps.history);
        return { status: HttpStatus.Ok, body: { applied } };
      }
    },
    {
      method: 'GET', path: `${BASE}/public`, handle: async (context) => {
        const { limit, offset } = page(context);
        return { status: HttpStatus.Ok, body: { items: await context.deps.publicStore.listSlugs(limit, offset) }, headers: { 'cache-control': PUBLIC_CACHE } };
      }
    },
    {
      method: 'GET', path: `${BASE}/public/:slug`, handle: async (context) => {
        const view = await getPublicCelebration(context.deps.publicStore, context.params['slug'] ?? '', context.acceptLanguage);
        return { status: HttpStatus.Ok, body: view, headers: { 'cache-control': PUBLIC_CACHE, vary: 'accept-language', 'content-language': view.locale, etag: etag(view.version) } };
      }
    },
    {
      method: 'POST', path: BASE, handle: async (context) => {
        const request = await context.request();
        const state = await createCelebration(context.deps.app, request, await context.body(createCelebrationBody));
        return { ...withVersion(state, HttpStatus.Created), headers: { etag: etag(state.version), location: `${BASE}/${state.id}` } };
      }
    },
    {
      method: 'GET', path: BASE,
      handle: async (context) => ({ status: HttpStatus.Ok, body: { items: await listCelebrations(context.deps.app, await context.request(), page(context)) } })
    },
    {
      method: 'GET', path: `${BASE}/:celebrationId`, handle: async (context) => {
        const view = await getCelebration(context.deps.app, await context.request(), celebrationId(context));
        return { status: HttpStatus.Ok, body: view, headers: { etag: etag(view.version) } };
      }
    },
    {
      method: 'PATCH', path: `${BASE}/:celebrationId`, handle: async (context) => {
        const request = await context.request();
        const patch = await context.body(editCelebrationBody);
        return withVersion(await editCelebration(context.deps.app, request, { ...mutation(context), patch }));
      }
    },
    {
      method: 'GET', path: `${BASE}/:celebrationId/settings`, handle: async (context) => {
        const view = await getCelebration(context.deps.app, await context.request(), celebrationId(context));
        return { status: HttpStatus.Ok, body: view.settings, headers: { etag: etag(view.version) } };
      }
    },
    {
      method: 'PUT', path: `${BASE}/:celebrationId/settings`, handle: async (context) => {
        const request = await context.request();
        // Zod strips nothing here (strict object) and every key is optional, matching SettingsPatch.
        const patch = (await context.body(settingsBody)) as SettingsPatch;
        return withVersion(await updateSettings(context.deps.app, request, { ...mutation(context), patch }));
      }
    },
    {
      method: 'PUT', path: `${BASE}/:celebrationId/event-type`, handle: async (context) => {
        const request = await context.request();
        const body = await context.body(eventTypeBody);
        return withVersion(await assignEventType(context.deps.app, request, { ...mutation(context), eventTypeCode: body.eventTypeCode }));
      }
    },
    {
      method: 'PUT', path: `${BASE}/:celebrationId/template`, handle: async (context) => {
        const request = await context.request();
        const body = await context.body(templateBody);
        return withVersion(await selectTemplate(context.deps.app, request, { ...mutation(context), templateId: body.templateId }));
      }
    },
    {
      method: 'PUT', path: `${BASE}/:celebrationId/collaborators/:userId`, handle: async (context) => {
        const request = await context.request();
        const body = await context.body(collaboratorBody);
        return withVersion(await setCollaborator(context.deps.app, request, { ...mutation(context), userId: context.params['userId'] ?? '', role: body.role }));
      }
    },
    {
      method: 'DELETE', path: `${BASE}/:celebrationId/collaborators/:userId`, handle: async (context) => {
        const request = await context.request();
        return withVersion(await setCollaborator(context.deps.app, request, { ...mutation(context), userId: context.params['userId'] ?? '', role: null }));
      }
    },
    {
      method: 'GET', path: `${BASE}/:celebrationId/publish-check`,
      handle: async (context) => ({ status: HttpStatus.Ok, body: await publishCheck(context.deps.app, await context.request(), celebrationId(context)) })
    },
    {
      method: 'POST', path: `${BASE}/:celebrationId/publish`, handle: async (context) => {
        const request = await context.request();
        return withVersion(await publishCelebration(context.deps.app, request, mutation(context)));
      }
    },
    {
      method: 'POST', path: `${BASE}/:celebrationId/unpublish`, handle: async (context) => {
        const request = await context.request();
        const body = await context.optionalBody(unpublishBody);
        return withVersion(await unpublishCelebration(context.deps.app, request, { ...mutation(context), reason: body.reason ?? null }));
      }
    },
    {
      method: 'POST', path: `${BASE}/:celebrationId/archive`, handle: async (context) => {
        const request = await context.request();
        return withVersion(await archiveCelebration(context.deps.app, request, mutation(context)));
      }
    },
    {
      method: 'GET', path: `${BASE}/:celebrationId/audit`,
      handle: async (context) => ({ status: HttpStatus.Ok, body: { items: await getAuditLog(context.deps.app, await context.request(), celebrationId(context)) } })
    }
  ];
}

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ZodError, type ZodType } from 'zod';
import { DomainError } from '../../domain/errors.js';
import type { Actor } from '../../domain/policy/access.js';
import { UnauthorizedError, type Authenticator } from '../../infrastructure/auth/jwt-authenticator.js';
import type { ApplicationDeps, RequestContext } from '../../application/command/command-runner.js';
import type { EventHistory, PublicCelebrationStore } from '../../application/ports.js';
import type { PublicCelebrationProjector } from '../../infrastructure/projection/public-celebration-projector.js';
import { routes } from './routes.js';

/**
 * HTTP adapter over node:http. It maps requests to application use cases and
 * domain errors to RFC 9457 problems; it holds no business rule of its own.
 */

export const HttpStatus = {
  Ok: 200, Created: 201, NoContent: 204, BadRequest: 400, Unauthorized: 401, NotFound: 404,
  PayloadTooLarge: 413, UnsupportedMediaType: 415, PreconditionRequired: 428, Internal: 500
} as const;

const MAX_BODY_BYTES = 524_288;
const JSON_TYPE = 'application/json';
const PROBLEM_TYPE = 'application/problem+json';
const PROBLEM_BASE = 'https://rsvp.example/problems/';
const CORRELATION_HEADER = 'x-correlation-id';
const ROOT_SEGMENT = 'celebrations';

// Canonical UUID. Matches "0b6f8c1e-2a1d-4c5e-9f00-1234567890ab"; rejects "not-a-uuid".
// https://regex101.com/?flavor=javascript&regex=%5E%5B0-9a-f%5D%7B8%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B12%7D%24&flags=gmi&testString=0b6f8c1e-2a1d-4c5e-9f00-1234567890ab%0Anot-a-uuid
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strong or weak ETag holding a version. Matches 'W/"3"' → ("3"); rejects "abc".
// https://regex101.com/?flavor=javascript&regex=%5E(%3F%3AW%5C%2F)%3F%22%3F(%5Cd%2B)%22%3F%24&flags=gm&testString=W%2F%223%22%0Aabc
const VERSION_TAG = /^(?:W\/)?"?(\d+)"?$/;

export interface HttpLogger {
  info(message: string, fields: Readonly<Record<string, unknown>>): void;
  error(message: string, fields: Readonly<Record<string, unknown>>): void;
}

export interface HttpDependencies {
  readonly app: ApplicationDeps;
  readonly authenticator: Authenticator;
  readonly publicStore: PublicCelebrationStore;
  readonly projector: PublicCelebrationProjector;
  readonly history: EventHistory;
  readonly ready: () => Promise<boolean>;
  readonly logger: HttpLogger;
}

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Readonly<Record<string, unknown>>) { super(message); }
}

export interface Reply {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Everything a route handler may use; parsing helpers throw HttpError with the right status. */
export interface RouteContext {
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly correlationId: string;
  readonly acceptLanguage: string | undefined;
  readonly deps: HttpDependencies;
  body<TBody>(schema: ZodType<TBody>): Promise<TBody>;
  optionalBody<TBody>(schema: ZodType<TBody>): Promise<TBody>;
  /** Authenticated request context (401 when the token is missing or invalid). */
  request(): Promise<RequestContext>;
  actor(): Promise<Actor>;
  /** Version from If-Match; 428 when absent so no write is ever blind. */
  expectedVersion(): number;
}

export interface Route {
  readonly method: string;
  readonly path: string;
  readonly handle: (context: RouteContext) => Promise<Reply>;
}

const PARAM_PREFIX = ':';

function matchRoute(route: Route, method: string, segments: readonly string[]): Readonly<Record<string, string>> | undefined {
  const pattern = route.path.split('/').filter(Boolean);
  if (route.method !== method || pattern.length !== segments.length) return undefined;
  const pairs = pattern.map((part, index) => [part, segments[index] ?? ''] as const);
  if (!pairs.every(([part, value]) => part.startsWith(PARAM_PREFIX) || part === value)) return undefined;
  const params = Object.fromEntries(pairs.filter(([part]) => part.startsWith(PARAM_PREFIX)).map(([part, value]) => [part.slice(1), decodeURIComponent(value)]));
  // Ids that are not UUIDs cannot exist; answering 404 keeps the response identical to "not yours".
  const celebrationId = params['celebrationId'];
  return celebrationId !== undefined && !UUID_PATTERN.test(celebrationId) ? undefined : params;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks = await request.toArray();
  const buffer = Buffer.concat(chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))));
  if (buffer.length > MAX_BODY_BYTES) throw new HttpError(HttpStatus.PayloadTooLarge, 'PAYLOAD_TOO_LARGE', `Body must be at most ${MAX_BODY_BYTES} bytes`);
  return buffer.toString('utf8');
}

function problem(status: number, code: string, title: string, correlationId: string, details: Readonly<Record<string, unknown>> = {}): Reply {
  return { status, body: { type: `${PROBLEM_BASE}${code.toLowerCase()}`, title, status, code, correlationId, ...details } };
}

function toProblem(error: unknown, correlationId: string, logger: HttpLogger): Reply {
  if (error instanceof DomainError) return problem(error.status, error.code, error.message, correlationId, error.details);
  if (error instanceof HttpError) return problem(error.status, error.code, error.message, correlationId, error.details);
  if (error instanceof UnauthorizedError) {
    return { ...problem(HttpStatus.Unauthorized, 'UNAUTHORIZED', 'A valid bearer token is required', correlationId), headers: { 'www-authenticate': 'Bearer' } };
  }
  if (error instanceof ZodError) {
    return problem(HttpStatus.BadRequest, 'BAD_REQUEST', 'The request body is not valid', correlationId, { issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) });
  }
  logger.error('unhandled error', { correlationId, error: error instanceof Error ? error.message : String(error) });
  return problem(HttpStatus.Internal, 'INTERNAL', 'Unexpected error', correlationId);
}

function send(response: ServerResponse, reply: Reply, correlationId: string): void {
  const isProblem = reply.status >= HttpStatus.BadRequest;
  const hasBody = reply.body !== undefined && reply.status !== HttpStatus.NoContent;
  response.writeHead(reply.status, {
    ...(hasBody ? { 'content-type': isProblem ? PROBLEM_TYPE : JSON_TYPE } : {}),
    [CORRELATION_HEADER]: correlationId,
    'cache-control': 'no-store',
    ...reply.headers
  });
  response.end(hasBody ? JSON.stringify(reply.body) : undefined);
}

function contextFor(request: IncomingMessage, url: URL, params: Readonly<Record<string, string>>, correlationId: string, deps: HttpDependencies): RouteContext {
  let cachedActor: Promise<Actor> | undefined;
  const parse = async <TBody>(schema: ZodType<TBody>, optional: boolean): Promise<TBody> => {
    const raw = await readBody(request);
    if (!raw.trim() && optional) return schema.parse({});
    if (!(request.headers['content-type'] ?? '').startsWith(JSON_TYPE)) throw new HttpError(HttpStatus.UnsupportedMediaType, 'UNSUPPORTED_MEDIA_TYPE', 'Send application/json');
    const json = ((): unknown => {
      try { return JSON.parse(raw); } catch { throw new HttpError(HttpStatus.BadRequest, 'BAD_REQUEST', 'Body is not valid JSON'); }
    })();
    return schema.parse(json);
  };
  const actor = async (): Promise<Actor> => {
    cachedActor ??= deps.authenticator.authenticate(request.headers.authorization);
    return cachedActor;
  };
  return {
    params,
    query: url.searchParams,
    correlationId,
    acceptLanguage: request.headers['accept-language'],
    deps,
    body: async (schema) => parse(schema, false),
    optionalBody: async (schema) => parse(schema, true),
    actor,
    request: async () => ({ actor: await actor(), correlationId }),
    expectedVersion: () => {
      const header = request.headers['if-match'];
      const match = header ? VERSION_TAG.exec(header) : null;
      if (!match) throw new HttpError(HttpStatus.PreconditionRequired, 'PRECONDITION_REQUIRED', 'Send If-Match with the version you edited');
      return Number(match[1]);
    }
  };
}

const correlationIdOf = (request: IncomingMessage): string => {
  const header = request.headers[CORRELATION_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value && UUID_PATTERN.test(value) ? value : randomUUID();
};

export function createHttpServer(deps: HttpDependencies): Server {
  const table = routes();
  return createServer((request, response) => {
    void (async () => {
      const started = performance.now();
      const correlationId = correlationIdOf(request);
      const url = new URL(request.url ?? '/', 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      const method = request.method ?? 'GET';
      const found = segments[0] === ROOT_SEGMENT
        ? table.map((route) => ({ route, params: matchRoute(route, method, segments) })).find((candidate) => candidate.params !== undefined)
        : undefined;
      const reply = await (async (): Promise<Reply> => {
        if (!found?.params) return problem(HttpStatus.NotFound, 'NOT_FOUND', 'Not found', correlationId);
        try {
          return await found.route.handle(contextFor(request, url, found.params, correlationId, deps));
        } catch (error) {
          return toProblem(error, correlationId, deps.logger);
        }
      })();
      send(response, reply, correlationId);
      deps.logger.info('http_request', { method, route: found?.route.path ?? 'unmatched', status: reply.status, durationMs: Math.round(performance.now() - started), correlationId });
    })();
  });
}

/**
 * Domain errors carry the HTTP status they map to so that every adapter answers
 * the same way. The domain never imports a framework; the status is just data.
 */
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;
const STATUS_UNPROCESSABLE = 422;

export abstract class DomainError extends Error {
  abstract readonly status: number;
  constructor(readonly code: string, message: string, readonly details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = new.target.name;
  }
}

/** Something does not exist *or the actor may not know it exists*: cross-tenant reads answer 404, never 403. */
export class NotFoundError extends DomainError {
  readonly status = STATUS_NOT_FOUND;
  constructor(what = 'Celebration') { super('NOT_FOUND', `${what} not found`); }
}

/** The actor can see the celebration but lacks the role for this action. */
export class ForbiddenError extends DomainError {
  readonly status = STATUS_FORBIDDEN;
  constructor(message: string) { super('FORBIDDEN', message); }
}

/** State conflicts: forbidden transitions, stale versions, slug taken or immutable. */
export class ConflictError extends DomainError {
  readonly status = STATUS_CONFLICT;
}

/** A domain invariant was violated by otherwise well-formed input. */
export class InvariantError extends DomainError {
  readonly status = STATUS_UNPROCESSABLE;
}

/** Publishing was rejected; `missingFields` lists exactly what the event type still requires. */
export class PublishRequirementsError extends DomainError {
  readonly status = STATUS_UNPROCESSABLE;
  constructor(readonly missingFields: readonly string[]) {
    super('PUBLISH_REQUIREMENTS_MISSING', `Missing required fields: ${missingFields.join(', ')}`, { missingFields: [...missingFields] });
  }
}

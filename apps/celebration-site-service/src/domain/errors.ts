export class DomainError extends Error { constructor(message: string, readonly code: number = 409) { super(message); } }
export class ValidationError extends DomainError { constructor(readonly missingFields: string[]) { super(`Missing required fields: ${missingFields.join(', ')}`, 422); } }
export class NotFoundError extends DomainError { constructor() { super('Celebration not found', 404); } }

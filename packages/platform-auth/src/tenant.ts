import { AsyncLocalStorage } from 'node:async_hooks';
import type { JwtClaims } from './jwt.js';

export type CelebrationId = string & { readonly __brand: 'CelebrationId' };
export interface TenantContextValue { celebrationId: CelebrationId; correlationId?: string; subject?: string; }
export const tenantStorage = new AsyncLocalStorage<TenantContextValue>();

export function asCelebrationId(value: string): CelebrationId {
  if (!value.trim()) throw new Error('celebrationId is required.');
  return value as CelebrationId;
}

export function currentTenant(): TenantContextValue {
  const context = tenantStorage.getStore();
  if (!context) throw new Error('TenantContext is unavailable outside a tenant-scoped request.');
  return context;
}

export function runWithTenant<T>(context: TenantContextValue, work: () => T): T {
  return tenantStorage.run(context, work);
}

/** Path takes precedence only when it agrees with the token, preventing tenant spoofing. */
export function tenantFromRequest(params: Record<string, string | undefined>, claims: JwtClaims, correlationId?: string): TenantContextValue {
  const pathTenant = params.celebrationId;
  const tokenTenant = claims.celebrationId;
  if (!pathTenant && !tokenTenant) throw new Error('No celebrationId was supplied by route or token.');
  if (pathTenant && tokenTenant && pathTenant !== tokenTenant) throw new Error('Cross-tenant request rejected.');
  return { celebrationId: asCelebrationId(pathTenant ?? tokenTenant as string), correlationId, subject: claims.sub };
}

export interface TenantScopedRepository<T> {
  findById(celebrationId: CelebrationId, id: string): Promise<T | undefined>;
  save(celebrationId: CelebrationId, value: T): Promise<void>;
}

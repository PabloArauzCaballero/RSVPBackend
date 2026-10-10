import type { JwtClaims } from './jwt.js';
import { runWithTenant, tenantFromRequest, type TenantContextValue } from './tenant.js';

export class TenantContextGuard {
  enter<T>(params: Record<string, string | undefined>, claims: JwtClaims, work: (context: TenantContextValue) => T, correlationId?: string): T {
    const context = tenantFromRequest(params, claims, correlationId);
    return runWithTenant(context, () => work(context));
  }
}

export interface RateLimiter { check(key: string): Promise<boolean>; }
export async function allowPublicRoute(rateLimiter: RateLimiter, key: string): Promise<void> {
  if (!(await rateLimiter.check(key))) throw new Error('Rate limit exceeded.');
}

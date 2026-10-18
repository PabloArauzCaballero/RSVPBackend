import { createPublicKey, verify, type JsonWebKey as NodeJsonWebKey } from 'node:crypto';
import { decodeJwt, JwksJwtValidator, UnauthorizedError, type JsonWebKey, type JwksFetcher, type JwtClaims, type SignatureVerifier } from '@rsvp/platform-auth';
import type { Actor } from '../../domain/policy/access.js';

export { UnauthorizedError };
export interface JsonWebKeySet { keys: JsonWebKey[] }

const RS256 = 'RS256';
const NODE_ALGORITHM = 'RSA-SHA256';
const BEARER_PREFIX = 'Bearer ';
const TOKEN_SEPARATOR = '.';
const SIGNATURE_PART = 2;

/** RS256 only: a token announcing any other alg (none, HS256...) is rejected before key lookup. */
export const rs256Verifier: SignatureVerifier = {
  async verify(token: string, key: JsonWebKey): Promise<boolean> {
    if (decodeJwt(token).header.alg !== RS256) return false;
    const parts = token.split(TOKEN_SEPARATOR);
    const signingInput = parts.slice(0, SIGNATURE_PART).join(TOKEN_SEPARATOR);
    // The JWK comes from the identity JWKS document; node validates its fields.
    const publicKey = createPublicKey({ key: key as NodeJsonWebKey, format: 'jwk' });
    return verify(NODE_ALGORITHM, Buffer.from(signingInput), publicKey, Buffer.from(parts[SIGNATURE_PART] ?? '', 'base64url'));
  }
};

export function httpJwks(url: string): JwksFetcher {
  return {
    async fetch(): Promise<{ keys: JsonWebKey[] }> {
      const response = await fetch(url);
      if (!response.ok) throw new UnauthorizedError(`JWKS unavailable (${response.status})`);
      // The JWKS endpoint returns { keys: [...] } per RFC 7517.
      return (await response.json()) as { keys: JsonWebKey[] };
    }
  };
}

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

/** Claims → Actor. `roles` and `organizationIds` are optional claims; absent means a plain host. */
export function actorFromClaims(claims: JwtClaims): Actor {
  return { userId: claims.sub, roles: stringList(claims.roles), organizationIds: stringList(claims.organizationIds) };
}

export interface Authenticator { authenticate(authorization: string | undefined): Promise<Actor> }

export function jwtAuthenticator(jwks: JwksFetcher, nowSeconds?: () => number): Authenticator {
  const validator = new JwksJwtValidator(jwks, rs256Verifier, nowSeconds);
  return {
    async authenticate(authorization) {
      if (!authorization?.startsWith(BEARER_PREFIX)) throw new UnauthorizedError('Bearer token required');
      return actorFromClaims(await validator.validate(authorization.slice(BEARER_PREFIX.length)));
    }
  };
}

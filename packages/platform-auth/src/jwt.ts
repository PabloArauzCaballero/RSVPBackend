export interface JwtClaims {
  sub: string;
  exp: number;
  iat?: number;
  celebrationId?: string;
  roles?: string[];
  [claim: string]: unknown;
}

export interface JsonWebKey { kid?: string; kty: string; [property: string]: unknown; }
export interface JwksFetcher { fetch(): Promise<{ keys: JsonWebKey[] }>; }
export interface SignatureVerifier { verify(token: string, key: JsonWebKey): Promise<boolean>; }

export class UnauthorizedError extends Error { constructor(message = 'Unauthorized') { super(message); this.name = 'UnauthorizedError'; } }

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0)));
}

export function decodeJwt(token: string): { header: Record<string, unknown>; claims: JwtClaims } {
  const [encodedHeader, encodedClaims, signature, ...rest] = token.split('.');
  if (!encodedHeader || !encodedClaims || !signature || rest.length) throw new UnauthorizedError('Malformed JWT.');
  try {
    const header = JSON.parse(decodeBase64Url(encodedHeader)) as Record<string, unknown>;
    const claims = JSON.parse(decodeBase64Url(encodedClaims)) as JwtClaims;
    return { header, claims };
  } catch { throw new UnauthorizedError('Malformed JWT payload.'); }
}

export class JwksJwtValidator {
  private keys = new Map<string, JsonWebKey>();
  constructor(private readonly jwks: JwksFetcher, private readonly verifier: SignatureVerifier, private readonly nowSeconds = () => Math.floor(Date.now() / 1000)) {}
  async validate(token: string): Promise<JwtClaims> {
    const decoded = decodeJwt(token);
    const kid = decoded.header.kid;
    if (typeof kid !== 'string' || !kid) throw new UnauthorizedError('JWT is missing kid.');
    let key = this.keys.get(kid);
    if (!key) { await this.refresh(); key = this.keys.get(kid); }
    if (!key || !(await this.verifier.verify(token, key))) {
      await this.refresh();
      key = this.keys.get(kid);
      if (!key || !(await this.verifier.verify(token, key))) throw new UnauthorizedError('Invalid JWT signature.');
    }
    if (!decoded.claims.sub || !Number.isFinite(decoded.claims.exp) || decoded.claims.exp <= this.nowSeconds()) throw new UnauthorizedError('Expired or incomplete JWT.');
    return decoded.claims;
  }
  private async refresh(): Promise<void> { this.keys = new Map((await this.jwks.fetch()).keys.filter((key) => typeof key.kid === 'string').map((key) => [key.kid as string, key])); }
}

export class JwtGuard {
  constructor(private readonly validator: JwksJwtValidator) {}
  async authenticate(authorization?: string): Promise<JwtClaims> {
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedError('Bearer token required.');
    return this.validator.validate(authorization.slice(7));
  }
}

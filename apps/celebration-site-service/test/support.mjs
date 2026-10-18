import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';
import { buildRuntime, jwtAuthenticator, readSeeds } from '../dist/index.js';

/** Real RS256 keys and tokens: authentication in tests is the production code path. */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
export const jwks = { fetch: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] }) };

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function sign(claims, { alg = 'RS256', kid = KID, expiresIn = 900 } = {}) {
  const header = b64({ alg, typ: 'JWT', kid });
  const payload = b64({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresIn, ...claims });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey).toString('base64url')}`;
}

export const user = (overrides = {}) => ({ sub: randomUUID(), roles: ['HOST'], organizationIds: [], ...overrides });
export const tokenFor = (claims) => sign(claims);

export const ALL_SEEDS = await readSeeds();
export const CORE_SEEDS = ALL_SEEDS.filter((type) => type.code === 'WEDDING' || type.code === 'QUINCEANERA');

export async function start(config = {}) {
  const runtime = await buildRuntime({ authenticator: jwtAuthenticator(jwks), seeds: CORE_SEEDS, ...config });
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));
  const { port } = runtime.server.address();
  const base = `http://127.0.0.1:${port}`;
  const api = async (method, path, { token, body, ifMatch, headers = {}, raw } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(ifMatch !== undefined ? { 'if-match': `"${ifMatch}"` } : {}),
        ...headers
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
  };
  return { runtime, api, base, close: () => runtime.close() };
}

/** Waits until every committed event reached the in-process consumers. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

export const weddingContent = {
  title: 'Ana y Luis',
  eventDate: '2026-12-19T19:00',
  venueName: 'Hacienda El Prado',
  hosts: { BRIDE: 'Ana', GROOM: 'Luis' }
};

export async function createWedding(api, token, overrides = {}) {
  const response = await api('POST', '/celebrations', { token, body: { slug: `boda-${randomUUID().slice(0, 8)}`, eventTypeCode: 'WEDDING', content: weddingContent, ...overrides } });
  if (response.status !== 201) throw new Error(`create failed ${response.status} ${JSON.stringify(response.body)}`);
  return response.body;
}

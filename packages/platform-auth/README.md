# Platform auth

Every internal service validates the bearer token again even after Kong: the
service boundary is still a trust boundary, and this protects direct/internal
calls and a misconfigured gateway. `JwksJwtValidator` caches keys by `kid` and
refreshes once when a key is absent or verification fails, enabling a safe key
rollover.

`TenantContextGuard` installs the `celebrationId` in `AsyncLocalStorage`. Any
tenant repository must receive the branded `CelebrationId` argument explicitly;
absence is a TypeScript compile error. Endpoint tests can use:

```ts
await expectCrossTenantNotFound(() => requestAs(otherCelebration));
```

Public RSVP/magic-link routes do not use `JwtGuard`; they must call
`allowPublicRoute` with their rate limiter before running the handler.

# Identity Service

## Signing-key rotation

1. Generate a new RSA-2048 key and assign a new `kid`.
2. Publish both the old and new public keys from `/.well-known/jwks.json`.
3. Start issuing only with the new `kid`.
4. Keep the old public key for at least 15 minutes plus clock skew, then remove it.

Services refresh their JWKS cache once for a missing `kid` or failed signature,
so a rolling deployment does not make valid access tokens fail.

## Password recovery and logout

`POST /identity/auth/password-recovery` must reply `202` for both known and
unknown email addresses. Never log the supplied email or recovery token.
`POST /identity/auth/logout` accepts `{"refreshToken":"..."}` and revokes
the entire refresh-token chain. Repeating logout is a successful no-op.

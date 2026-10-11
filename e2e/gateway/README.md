# Gateway E2E

`node --test e2e/gateway/validate-config.mjs` verifies the declarative
topology locally. The live tests for 401 against remote JWKS are intentionally
blocked until the supported Kong OIDC/JWKS plugin and its configuration are
provisioned; see `docs/runbooks/gateway.md`.

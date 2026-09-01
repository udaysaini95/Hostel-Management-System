# HostelMate Runtime Configuration

The API validates its runtime configuration before accepting requests. Missing credentials, placeholder values, malformed database URLs, weak JWT secrets, and invalid ports stop startup with a consolidated error message.

## Required API variables

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Valid `postgres://` or `postgresql://` connection URL with no example placeholders |
| `JWT_SECRET` | Non-placeholder secret containing at least 32 characters |
| `JWT_EXPIRES_IN` | Optional positive duration such as `15m` or `1h`; defaults to `1h` and cannot exceed `1d` |

`PORT` is optional and defaults to `5000`. When provided, it must be an integer from `1` through `65535`. `NODE_ENV` defaults to `development` and accepts only `development`, `test`, or `production`.

Generate a JWT secret with a trusted password manager or cryptographically secure random generator. Never commit the generated value; local `.env` files are ignored by Git.

## Access-session contract

Successful registration and login responses include an expiring Bearer access token. Tokens are signed with `HS256` and contain a standard subject, role, normalized email, access-token type, issuer, audience, unique session ID, issued-at time, and expiry time. The API accepts only this exact issuer, audience, algorithm, token type, and supported-role set.

Protected endpoints return `SESSION_EXPIRED` for expired credentials, `INVALID_ACCESS_TOKEN` for malformed or tampered credentials, and `AUTH_TOKEN_REQUIRED` when the strict `Bearer <token>` header is missing. A successful password login also updates `last_login_at`.

## Demo-seed variables

The demo seed additionally requires:

| Variable | Requirement |
| --- | --- |
| `ALLOW_DEMO_SEED` | Must equal `true` and is rejected in production |
| `DEMO_SEED_PASSWORD` | At least 12 characters, with no built-in fallback |

See [DEMO_DATA.md](./DEMO_DATA.md) for the fictional accounts and seed workflow.

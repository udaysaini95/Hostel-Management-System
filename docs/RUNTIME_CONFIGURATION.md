# HostelMate Runtime Configuration

The API validates its runtime configuration before accepting requests. Missing credentials, placeholder values, malformed database URLs, weak JWT secrets, and invalid ports stop startup with a consolidated error message.

## Required API variables

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Valid `postgres://` or `postgresql://` connection URL with no example placeholders |
| `JWT_SECRET` | Non-placeholder secret containing at least 32 characters |
| `JWT_EXPIRES_IN` | Optional positive duration such as `15m` or `1h`; defaults to `1h` and cannot exceed `1d` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins. Required in production; defaults to local Vite origins outside production. |
| `TRUST_PROXY_HOPS` | Number of trusted reverse proxies in front of the API, from `0` through `2`; defaults to `0`. |

`PORT` is optional and defaults to `5000`. When provided, it must be an integer from `1` through `65535`. `NODE_ENV` defaults to `development` and accepts only `development`, `test`, or `production`.

An origin contains only the protocol, host, and optional port—for example,
`https://hostel.example` or `http://localhost:5173`. Do not include routes.
Set `TRUST_PROXY_HOPS=1` only when exactly one trusted load balancer or reverse
proxy sits between the public client and the API. An incorrect value can make
IP-based rate limiting group unrelated users or trust a spoofed address.

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

## Frontend service variables

The Vite frontend uses one configuration module for API requests and files
served by the backend or an asset host:

| Variable | Requirement |
| --- | --- |
| `VITE_API_BASE_URL` | Optional absolute HTTP(S) origin for the API, such as `https://api.hostel.example`. When omitted, requests use the browser's current origin. |
| `VITE_ASSET_BASE_URL` | Optional absolute HTTP(S) origin for uploaded files or a future CDN. It defaults to `VITE_API_BASE_URL`. |

Configured values must be origins only. Credentials, paths, query strings,
fragments, and non-HTTP protocols are rejected when Vite loads its configuration.
The same-origin default supports deployments where a reverse proxy exposes the
frontend and `/api` from one host.

For local development with Vite and the API on different ports, copy
`Frontend/.env.example` to `Frontend/.env`. Components must use the shared Axios
client and asset helpers instead of reading `import.meta.env` or constructing a
host URL themselves.

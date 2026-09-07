# HostelMate API Security Baseline

This document records the protections introduced in the API-02 implementation
slice. It is an operational baseline, not a replacement for the final security
review planned in `SEC-01`.

## Authentication throttling

Authentication limits use the client IP address and a 15-minute window:

| Endpoint | Limit | Counting behavior |
| --- | --- | --- |
| `POST /api/auth/login` | 10 | Only failed responses count. |
| `POST /api/auth/student-activation/request` | 5 | Every request counts because the public response deliberately hides whether a student matched. |
| Staff invitation acceptance and student activation completion | 10 combined | Only failed responses count. |

A blocked request returns HTTP `429`, the error code `AUTH_RATE_LIMITED`, a
safe message, standard `RateLimit` metadata, and `Retry-After`.

The current limiter uses in-process memory, which is appropriate for one API
instance. Before running multiple API instances, replace the store with a shared
Redis-compatible store so every instance enforces one common quota.

## Browser and response security

- Helmet supplies defensive browser headers and removes framework disclosure.
- Browser origins are checked against `CORS_ALLOWED_ORIGINS`.
- Requests without an `Origin` header remain available to mobile,
  server-to-server, and command-line clients.
- Uploaded images use `Cross-Origin-Resource-Policy: cross-origin` because the
  current frontend and API can run on separate origins.
- The JSON body parser accepts at most `100kb` and returns a controlled `413`
  response above that limit.

## Upload resource limits

The legacy complaint upload route accepts at most:

- one file;
- 5 MiB per file;
- ten text fields;
- 50 KiB per text field; and
- eleven multipart sections in total.

The normalized complaint evidence route is stricter. It accepts one JPEG, PNG,
or WebP file in memory, limits it to 5 MiB, verifies its signature, assigns a
generated storage key, and records a SHA-256 checksum. Files live outside the
public upload directory and every list, view, or delete operation repeats the
complaint authorization check. Reporter deletion closes when staff work begins;
wardens cannot erase student evidence, while administrators retain a moderated,
audited deletion path.

## Deployment checklist

1. Set `NODE_ENV=production`.
2. Set an explicit HTTPS frontend origin in `CORS_ALLOWED_ORIGINS`.
3. Keep `TRUST_PROXY_HOPS=0` for a directly exposed API, or set the exact proxy
   count for the chosen hosting topology.
4. Confirm the production dependency audit reports zero known vulnerabilities.
5. Mount durable private storage at `PRIVATE_FILE_STORAGE_PATH` and confirm it
   is not below the public `uploads` directory.
6. Re-run the security middleware and rate-limit tests after infrastructure
   changes.

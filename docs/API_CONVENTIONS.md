# HostelMate API Conventions

This document describes the request-validation and error-response rules used by
the current API. New endpoints should follow the same rules so clients do not
need endpoint-specific error handling.

## Current base paths

The existing application uses `/api/auth`, `/api/admin`, `/api/complaints`,
`/api/audit-events`, `/api/leave`, `/api/mess`, and `/api/gate`.

The PRD targets a versioned `/api/v1` base. That migration is intentionally
deferred until the frontend and backend can move together without breaking
existing clients.

## Request validation

Routes validate input before running a controller. Each route may validate:

- `params` for resource identifiers;
- `query` for filtering, sorting, and pagination; and
- `body` for JSON or parsed multipart form fields.

Schemas are strict. Unknown fields are rejected instead of silently reaching
business logic. Successful validation also performs safe normalization such as
trimming text, lowercasing email addresses, uppercasing hostel codes, and
converting numeric route IDs.

Validation currently covers authentication, account provisioning, student
activation, audit searches, complaints, leave applications, mess operations,
and gate actions.

## Error response

Every API error has a stable machine-readable `code` and a safe human-readable
`message`:

```json
{
  "code": "COMPLAINT_NOT_FOUND",
  "message": "Complaint not found"
}
```

Validation failures also include the first useful message for each invalid
field. Field keys begin with the request location:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "fieldErrors": {
    "body.email": "Enter a valid email address",
    "params.id": "ID must be a positive integer"
  }
}
```

Clients may display `message` as a form-level fallback and use `fieldErrors`
when they support inline feedback. They should use `code`, not exact message
text, for conditional behavior.

## Status codes

| Status | Meaning in HostelMate |
| --- | --- |
| `400` | The request could not be parsed, such as malformed JSON. |
| `401` | Authentication is missing, invalid, or expired. |
| `403` | The authenticated account cannot perform the action. |
| `404` | The route or requested resource does not exist. |
| `409` | The request conflicts with an existing or related record. |
| `413` | The request body or uploaded file exceeds its limit. |
| `415` | The uploaded media type is unsupported. |
| `422` | Parsed input does not satisfy the endpoint schema. |
| `500` | An unexpected server error occurred. |
| `503` | A required external capability is temporarily unavailable. |

Create operations should return `201`. Accepted asynchronous work should return
`202`. Reads and successful updates normally return `200`.

## Safe error handling

- Database details, stack traces, SQL, credentials, and internal exception
  messages must never be returned to clients.
- Known domain errors may expose an intentionally written public message.
- Known database constraint codes map to generic conflict or validation errors.
- Unexpected errors are logged on the server and return
  `INTERNAL_SERVER_ERROR` with a generic message.
- Unknown routes return JSON with `ROUTE_NOT_FOUND`.
- Errors raised after response headers have been sent are delegated to Express.

## Adding an endpoint

1. Define or reuse a schema under `Backend/src/validation`.
2. Add `validateRequest(...)` after authentication, authorization, and any body
   parser required by the route.
3. Use `sendApiError` for expected controller failures.
4. Use `handleControllerError` in the controller's final `catch` block.
5. Add tests for valid normalization and invalid boundary cases.
6. Keep errors actionable but free of implementation details.

# Commitments API

## Base URL
All endpoints are relative to `/api/commitments`. All responses are JSON.

## Authentication
All requests require an `x-user-id` header containing the user ID. Requests without this header will return `401 Unauthorized`.

## Errors
Errors follow a consistent shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid commitment data",
    "details": { ... }
  }
}
```

Common status codes:

- `400` Validation error
- `401` Authentication required
- `403` Access to resource forbidden
- `404` Resource not found
- `500` Internal error (not exposed)

## Endpoints

### List commitments
`GET /api/commitments`

Query parameters:

- `page` (optional, default=1): page number, must be >=1
- `pageSize` (optional, default=20, max=100): number of items per page
- `status` (optional): one of `DRAFT`, `ACTIVE`, `COMPLETED`, `CANCELLED`

Response: paginated list of commitments.

### Create commitment
`POST /api/commitments`

Body (JSON):

- `title`: string, required, max 200 chars
- `amount`: number, required, positive
- `currency`: string, required, 3-letter code, uppercased
- `status`: optional, one of `DRAFT`/`ACTIVE`/`COMPLETED`/`CANCELLED`, defaults to `DRAFT`
- `dueDate`: optional ISO 8601 datetime

Success response: created commitment, status 201.

### Search commitments
`GET /api/commitments/search`

Query parameters:

- `q`: string, required, min 1, max 100
- `page`, `pageSize` as above

Response: paginated list of matching commitments.

### Get commitment
`GET /api/commitments/[id]` (not yet implemented in route but supported by service)

### Update commitment
`PATCH /api/commitments/[id]` (not yet implemented in route but supported by service)

### Delete commitment
`DELETE /api/commitments/[id]` (not yet implemented in route but supported by service)

## Contract
- `Commitment` object fields: `id`, `userId`, `title`, `amount`, `currency`, `status`, `dueDate?`, `createdAt`, `updatedAt`.
- Pagination response: `{ items, page, pageSize, totalItems, totalPages }`.
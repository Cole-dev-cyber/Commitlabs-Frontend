/**
 * Centralized APi error types and helpers.
 *
 * These utilities establish a consistent error contract across all API routes:
 * - Standardized error status codes and codes.
 * - Consistent JSON error response shape via `handleApiError`.
 * - Automatic mapping of common validation errors to `ValidationError` (HTTP 422).
 * - a validate` helper to parse route inputs with schema-like objects,
 *   converting any validation failure into a `ValidationError`.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly expose = true,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * Type guard for errors that look like validation errors from common libraries
 * (e.g., Zod, yup, Joi). These typically expose an `issues` array or a `details`
 * property along a recognizable name. We intentionally use a structural
 * check on `issues` to support multiple libraries without extra dependencies.
 */
function isValidationError(error: unknown): boolean {
  if (error instanceof ValidationError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const potential = error as Record<string, unknown>;
  // Zod and many modern validators expose an `issues` array
  return Array.isArray(potential.issues);
}

/**
 * Extracts structured details from a validation error if possible.
 * Returns undefined if no recognizable structure is found.
 */
function extractValidationDetails(error: unknown): unknown | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const potential = error as Record<string, unknown>;

  if (Array.isArray(potential.issues)) {
    return {
      issues: (potential.issues as Array<{path?: Array<string | number>; message?: string}>).map((issue) => ({
        path: issue.path ? issue.path.join('.') : '',
        message: issue.message ?? 'Invalid value',
      })),
    };
  }

  if ('details' in potential) {
    return potential.details;
  }

  return undefined;
}

/**
 * Converts any unknown error to a ValidationError.
 * If the error already is a ValidationError, it is returned unchanged.
 * Otherwise, it attempts to extract structured details from the error.
 */
export function toValidationError(error: unknown, message = 'Validation failed'): ValidationError {
  if (error instanceof ValidationError) return error;
  const details = extractValidationDetails(error);
  if (details !== undefined) return new ValidationError(message, details);
  if (error instanceof Error) return new ValidationError(message, { message: error.message });
  return new ValidationError(message);
}

/**
 * Validates `data` against a schema that exposes a `parse` method (e.g., Zod).
 * On success, returns the parsed value. On failure, throws a ValidationError
 * with structured details extracted from the schema's error.
 *
 * This helper centralizes route input validation and enforces a consistent
 * error contract across all API routes.
 */
export function validate<T>(schema: { parse(data: unknown): T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    throw toValidationError(error);
  }
}

/**
 * Normalizes any thrown value into an ApiError.
 *
 * - ApiError instances pass through unchanged.
 * - JSON parse errors become BadRequestError.
 * - Recognized validation errors become ValidationError (422).
 * - Everything else becomes a hidden 500 internal error.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof SyntaxError) return new BadRequestError('Malformed JSON in request body');
  if (isValidationError(error)) return toValidationError(error);
  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred', undefined, false);
}

/**
 * Converts any error into a consistent JSON error Response.
 * Uses the `expose` flag to decide whether the message is included.
 */
export function handleApiError(error: unknown): Response {
  const apiError = toApiError(error);
  return Response.json(
    {
      error: {
        code: apiError.code,
        message: apiError.expose ? apiError.message : 'An unexpected error occurred',
        ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      },
    },
    { status: apiError.status },
  );
}

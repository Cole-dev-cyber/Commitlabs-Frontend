export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown, public readonly expose = true) {
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

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof SyntaxError) return new BadRequestError('Malformed JSON in request body');
  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred', undefined, false);
}

export function handleApiError(error: unknown): Response {
  const apiError = toApiError(error);
  return Response.json({
    error: {
      code: apiError.code,
      message: apiError.expose ? apiError.message : 'An unexpected error occurred',
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
    },
  }, { status: apiError.status });
}

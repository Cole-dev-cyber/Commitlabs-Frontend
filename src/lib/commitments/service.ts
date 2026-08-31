import { z } from 'zod';

// Domain types
export enum CommitmentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Commitment {
  id: string;
  userId: string;
  title: string;
  amount: number;
  currency: string;
  status: CommitmentStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Validation schemas
const idSchema = z.string().uuid({ message: 'Invalid ID' });

const listParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(CommitmentStatus).optional(),
});

const searchParamsSchema = z.object({
  q: z.string().trim().min(1, 'Search query must not be empty').max(100, 'Search query too long'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createCommitmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  amount: z.number({ coerce: true }).positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').toUpperCase(),
  status: z.nativeEnum(CommitmentStatus).default(CommitmentStatus.DRAFT),
  dueDate: z.string().datetime({ offset: true }).optional(),
});

const updateCommitmentSchema = createCommitmentSchema.partial();

export interface ListParams {
  page?: number;
  pageSize?: number;
  status?: CommitmentStatus;
}

export interface SearchParams {
  q: string;
  page?: number;
  pageSize?: number;
}

export type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>;
export type UpdateCommitmentInput = z.infer<typeof updateCommitmentSchema>;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// Repository interface
export interface CommitmentRepository {
  list(userId: string, params: { status?: CommitmentStatus; page: number; pageSize: number }): Promise<{ items: Commitment[]; total: number }>;
  findById(id: string): Promise<Commitment | null>;
  search(userId: string, query: string, page: number, pageSize: number): Promise<{ items: Commitment[]; total: number }>;
  create(data: CreateCommitmentInput & { userId: string }): Promise<Commitment>;
  update(id: string, data: UpdateCommitmentInput): Promise<Commitment | null>;
  delete(id: string): Promise<boolean>;
}

// Error classes
export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message);
  }
}

// Service
export class CommitmentService {
  constructor(private repository: CommitmentRepository) {}

  async listCommitments(userId: string, params: ListParams = {}): Promise<PaginatedResult<Commitment>> {
    const parsed = listParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new ValidationError('Invalid list parameters', parsed.error.flatten());
    }

    const { page, pageSize, status } = parsed.data;
    const { items, total } = await this.repository.list(userId, { status, page, pageSize });

    return this.toPaginatedResult(items, page, pageSize, total);
  }

  async getCommitment(userId: string, id: string): Promise<Commitment> {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ValidationError('Invalid commitment ID', parsedId.error.flatten());
    }

    const commitment = await this.repository.findById(parsedId.data);
    if (!commitment) {
      throw new NotFoundError('Commitment not found');
    }
    if (commitment.userId !== userId) {
      throw new ForbiddenError('You do not have access to this commitment');
    }

    return commitment;
  }

  async searchCommitments(userId: string, params: SearchParams): Promise<PaginatedResult<Commitment>> {
    const parsed = searchParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new ValidationError('Invalid search parameters', parsed.error.flatten());
    }

    const { q, page, pageSize } = parsed.data;
    const { items, total } = await this.repository.search(userId, q, page, pageSize);

    return this.toPaginatedResult(items, page, pageSize, total);
  }

  async createCommitment(userId: string, data: CreateCommitmentInput): Promise<Commitment> {
    const parsed = createCommitmentSchema.safeParse(data);
    if (!parsed.success) {
      throw new ValidationError('Invalid commitment data', parsed.error.flatten());
    }

    const commitment = await this.repository.create({ ...parsed.data, userId });
    return commitment;
  }

  async updateCommitment(userId: string, id: string, data: UpdateCommitmentInput): Promise<Commitment> {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ValidationError('Invalid commitment ID', parsedId.error.flatten());
    }

    const parsed = updateCommitmentSchema.safeParse(data);
    if (!parsed.success) {
      throw new ValidationError('Invalid update data', parsed.error.flatten());
    }

    // Ensure the commitment exists and belongs to the user
    const existing = await this.repository.findById(parsedId.data);
    if (!existing) {
      throw new NotFoundError('Commitment not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenError('You do not have access to this commitment');
    }

    const updated = await this.repository.update(parsedId.data, parsed.data);
    if (!updated) {
      throw new NotFoundError('Commitment not found');
    }

    return updated;
  }

  async deleteCommitment(userId: string, id: string): Promise<void> {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ValidationError('Invalid commitment ID', parsedId.error.flatten());
    }

    const existing = await this.repository.findById(parsedId.data);
    if (!existing) {
      throw new NotFoundError('Commitment not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenError('You do not have access to this commitment');
    }

    await this.repository.delete(parsedId.data);
  }

  private toPaginatedResult(items: Commitment[], page: number, pageSize: number, total: number): PaginatedResult<Commitment> {
    const totalPages = pageSize === 0 ? 0 : Math.ceil(total / pageSize);
    return {
      items,
      page,
      pageSize,
      totalItems: total,
      totalPages,
    };
  }
}

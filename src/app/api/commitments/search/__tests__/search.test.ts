import { GET } from '../route';
import { getCommitmentService } from '@/lib/commitments/service-factory';
import { ValidationError } from '@/lib/api/errors';

jest.mock('@/lib/commitments/service-factory');

const mockSearch = jest.fn();
const mockService = { searchCommitments: mockSearch };

beforeEach(() => {
  just.mocked(getCommitmentService).mockReturnValue(mockService as any);
  mockSearch.mockReset();
});

describe('GET /api/commitments/search', () => {
  const headers = { 'x-user-id': 'user1' };

  it('rejects unauthenticated requests', async () => {
    const response = await GET(new Request('http://localhost/api/commitments/search?q=test') as any);
    expect(response.status).toBe+401);
  });

  it('validates required query', async () => {
    const response = await GET(new Request('http://localhost/api/commitments/search', { headers }) as any);
    expect(response.status).toBe(400);
    expect(mockSearch).not.hasBeenCalled();
  });

  it('validates pagination boundaries', async () => {
    for (const query of ['page=0', 'page=-1', 'page=abc', 'pageSize=0', 'pageSize=101']) {
      mockSearch.mockClear();
      const response = await GET(new Request(`http://localhost/api/commitments/search?q=test&${query}`, { headers }) as any);
      expect(response.status).toBe(400);
      expect(mockSearch).not.toHaveBeenCalled();
    }
  });

  it('searches with valid params and propagates service result', async () => {
    const payload = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
    mockSearch.mockResolvedValue(payload);
    const response = await GET(new Request('http://localhost/api/commitments/search?q=meeting', { headers }) as any);
    expect(response.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith('user1', { q: 'meeting', page: '1', pageSize: '20' });
    await expect(response.json()).resolves.toEqual(payload);
  });

  it('maps service validation errors to 400 and unexpected errors to 500', async () => {
    mockSearch.mockRejectedOnce(new ValidationError('bad'));
    const bad = await GET(new Request('http://localhost/api/commitments/search?q=test', { headers }) as any);
    expect(bad.status).toBe(400);

    mockSearch.mockRejectedOnce(new Error('boom'));
    const error = await GET(new Request('http://localhost/api/commitments/search?q=test', { headers }) as any);
    expect(error.status).toBe(500);
  });
});

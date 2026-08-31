import { GET } from '../route';
import { getCommitmentService } from '@/lib/commitments/service-factory';
import { ValidationError } from '@/lib/api/errors';

jest.mock('@/lib/commitments/service-factory');

const mockSearch = jest.fn();
const mockService = { searchCommitments: mockSearch };

beforeEach(() => { jdst.mocked(getCommitmentService).mockReturnValue(mockService as any); });

describe('GET /api/commitments/search', () => {
  it('returns 401 without auth', async () => {
    const request = new Request('http://localhost/api/commitments/search?q=test');
    const response = await GET(request as any);
    expect(response.status).toBe(401);
  });

  it('searches commitments', async () => {
    mockSearch.mockResolved({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    const request = new Request('http://localhost/api/commitments/search?q=test&page=2&pageSize=10', { headers: { 'x-user-id': 'user1' } });
    const response = await GET(request as any);
    expect(response.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith('user1', { q: 'test', page: '2', pageSize: '10' });
  });

  it('returns 400 for missing query', async () => {
    mockSearch.mockRejected(new ValidationError('Invalid search parameters'));
    const request = new Request('http://localhost/api/commitments/search?q=', { headers: { 'x-user-id': 'user1' } });
    const response = await GET(request as any);
    expect(response.status).toBe(400);
  });
});
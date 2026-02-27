import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './store';

const mockReport = {
  id: 'report-1',
  created_at: new Date().toISOString(),
  date_from: new Date().toISOString(),
  date_to: new Date().toISOString(),
  subreddits: ['lonely'],
  total_posts_analyzed: 10,
  summary: 'Test summary',
  signals: [
    {
      id: 'sig-1',
      category: 'emerging_topic',
      title: 'Test signal',
      description: 'Test description',
      strength: 'high',
      sentiment: 'mixed',
      postCount: 5,
      subreddits: ['lonely'],
    },
  ],
  raw_post_count: { lonely: 10 },
};

const mockGetAll = vi.fn().mockResolvedValue([]);
const mockDeleteFn = vi.fn().mockResolvedValue(undefined);

const mockSaveSettings = vi.fn().mockResolvedValue(undefined);
const mockLoadSettings = vi.fn().mockResolvedValue(null);

vi.mock('@shared/api', () => ({
  reportStorage: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    delete: (...args: unknown[]) => mockDeleteFn(...args),
  },
  saveSettings: (...args: unknown[]) => mockSaveSettings(...args),
  loadSettings: (...args: unknown[]) => mockLoadSettings(...args),
}));

const mockInvoke = vi.fn();

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      reports: [],
      isLoading: false,
      isGenerating: false,
      error: null,
    });
  });

  it('should have default subreddits', () => {
    const { subreddits } = useAppStore.getState();
    expect(subreddits).toHaveLength(3);
    expect(subreddits.map((s) => s.name)).toEqual(['lonely', 'depression', 'socialskills']);
    expect(subreddits.every((s) => s.enabled)).toBe(true);
  });

  it('should generate a report via Edge Function', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    mockGetAll.mockResolvedValue([
      {
        id: 'report-1',
        createdAt: new Date().toISOString(),
        dateRange: { from: new Date().toISOString(), to: new Date().toISOString() },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 10,
        summary: 'Test summary',
        signals: [mockReport.signals[0]],
        rawPostCount: { lonely: 10 },
      },
    ]);

    const { generateReport } = useAppStore.getState();
    const result = await generateReport();

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('daily-report', {
      body: { subreddits: ['lonely', 'depression', 'socialskills'] },
    });

    const { reports } = useAppStore.getState();
    expect(reports).toHaveLength(1);
    expect(reports[0].signals.length).toBeGreaterThan(0);
  });

  it('should handle Edge Function error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function failed' } });

    const { generateReport } = useAppStore.getState();
    const result = await generateReport();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Function failed');
    expect(useAppStore.getState().error).toBe('Function failed');
  });

  it('should update subreddits', () => {
    const { setSubreddits } = useAppStore.getState();
    setSubreddits([
      { name: 'lonely', enabled: true, category: 'core' },
      { name: 'mentalhealth', enabled: true, category: 'core' },
    ]);

    const { subreddits } = useAppStore.getState();
    expect(subreddits).toHaveLength(2);
    expect(subreddits[1].name).toBe('mentalhealth');
  });

  it('should clear error', () => {
    useAppStore.setState({ error: 'test error' });
    const { clearError } = useAppStore.getState();
    clearError();
    expect(useAppStore.getState().error).toBeNull();
  });

  it('should delete a report', async () => {
    useAppStore.setState({
      reports: [
        {
          id: 'r1',
          createdAt: new Date().toISOString(),
          dateRange: { from: '', to: '' },
          subreddits: ['lonely'],
          totalPostsAnalyzed: 1,
          summary: 'Test',
          signals: [],
          rawPostCount: { lonely: 1 },
        },
      ],
    });

    const { deleteReport } = useAppStore.getState();
    await deleteReport('r1');

    expect(mockDeleteFn).toHaveBeenCalledWith('r1');
    expect(useAppStore.getState().reports).toHaveLength(0);
  });
});

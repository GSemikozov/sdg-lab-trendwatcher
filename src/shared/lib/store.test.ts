import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './store';

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

vi.mock('@shared/api/reddit-service', () => ({
  createRedditService: () => ({
    fetchMultipleSubreddits: vi.fn().mockResolvedValue([
      {
        id: 'test1',
        title: 'Test post',
        selftext: 'Test body',
        score: 100,
        numComments: 50,
        subreddit: 'lonely',
        createdUtc: Date.now() / 1000,
        permalink: '/r/lonely/test1',
        topComments: [],
      },
    ]),
  }),
}));

vi.mock('@shared/api/ai-service', () => ({
  createAIService: () => ({
    analyzeRedditPosts: vi.fn().mockResolvedValue({
      id: 'report-1',
      createdAt: new Date().toISOString(),
      dateRange: { from: new Date().toISOString(), to: new Date().toISOString() },
      subreddits: ['lonely'],
      totalPostsAnalyzed: 1,
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
      rawPostCount: { lonely: 1 },
    }),
  }),
}));

describe('useAppStore', () => {
  beforeEach(() => {
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

  it('should generate a report', async () => {
    const { generateReport } = useAppStore.getState();
    const result = await generateReport();

    expect(result.success).toBe(true);

    const { reports } = useAppStore.getState();
    expect(reports).toHaveLength(1);
    expect(reports[0].signals.length).toBeGreaterThan(0);
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
    const { generateReport } = useAppStore.getState();
    await generateReport();

    const { reports, deleteReport } = useAppStore.getState();
    expect(reports).toHaveLength(1);

    await deleteReport(reports[0].id);
    expect(useAppStore.getState().reports).toHaveLength(0);
  });
});

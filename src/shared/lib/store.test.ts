import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetStoreGenerationGuardsForTests, useAppStore } from './store';

const mockSpace = {
  id: 'space-1',
  name: 'Test Space',
  slug: 'test-space',
  description: 'Test description',
  domainPrompt: 'You are a test analyst',
  creativePromptTemplate: '',
  subreddits: ['lonely', 'depression', 'socialskills'],
  emailRecipients: ['test@test.com'],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockGetAll = vi.fn().mockResolvedValue([]);
const mockDeleteFn = vi.fn().mockResolvedValue(undefined);

const mockLoadSpaces = vi.fn().mockResolvedValue([mockSpace]);
const mockUpdateSpace = vi.fn().mockResolvedValue(undefined);

vi.mock('@shared/api', () => ({
  reportStorage: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    delete: (...args: unknown[]) => mockDeleteFn(...args),
  },
  loadSpaces: (...args: unknown[]) => mockLoadSpaces(...args),
  updateSpace: (...args: unknown[]) => mockUpdateSpace(...args),
}));

const mockInvoke = vi.fn();

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

function setActiveSpace() {
  useAppStore.setState({
    spaces: [mockSpace],
    activeSpaceId: mockSpace.id,
  });
}

describe('useAppStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetStoreGenerationGuardsForTests();
    useAppStore.setState({
      spaces: [],
      activeSpaceId: null,
      reports: [],
      isLoading: false,
      isGenerating: false,
      error: null,
      settingsLoaded: false,
    });
  });

  it('should generate a report via Edge Function', async () => {
    setActiveSpace();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    mockGetAll.mockResolvedValue([
      {
        id: 'report-1',
        createdAt: new Date().toISOString(),
        dateRange: { from: new Date().toISOString(), to: new Date().toISOString() },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 10,
        summary: 'Test summary',
        signals: [],
        rawPostCount: { lonely: 10 },
        spaceId: mockSpace.id,
      },
    ]);

    const { generateReport } = useAppStore.getState();
    const result = await generateReport();

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('daily-report', {
      body: {
        space_id: mockSpace.id,
        subreddits: ['lonely', 'depression', 'socialskills'],
        emailRecipients: ['test@test.com'],
      },
    });

    const { reports } = useAppStore.getState();
    expect(reports).toHaveLength(1);
  });

  it('should handle Edge Function error', async () => {
    setActiveSpace();
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function failed' } });

    const { generateReport } = useAppStore.getState();
    const result = await generateReport();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Function failed');
    expect(useAppStore.getState().error).toBe('Function failed');
  });

  it('should update space settings', () => {
    setActiveSpace();
    const { updateSpaceSettings } = useAppStore.getState();
    updateSpaceSettings({ subreddits: ['lonely', 'mentalhealth'] });

    const { spaces } = useAppStore.getState();
    const space = spaces.find((s) => s.id === mockSpace.id);
    expect(space?.subreddits).toEqual(['lonely', 'mentalhealth']);
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

  it('should fail to generate report without active space', async () => {
    const { generateReport } = useAppStore.getState();
    const result = await generateReport();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No space selected');
  });

  it('should not replace reports if active space changed during report loading', async () => {
    setActiveSpace();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    let resolveGetAll: (value: unknown[]) => void = () => {};
    mockGetAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetAll = resolve;
        })
    );

    const pending = useAppStore.getState().generateReport();

    // Wait until getAll is in flight (after invoke resolved), then switch spaces.
    await vi.waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
    });

    useAppStore.setState({
      activeSpaceId: 'space-b',
      reports: [
        {
          id: 'space-b-report',
          createdAt: new Date().toISOString(),
          dateRange: { from: '', to: '' },
          subreddits: ['anxiety'],
          totalPostsAnalyzed: 2,
          summary: 'From space B',
          signals: [],
          rawPostCount: { anxiety: 2 },
          spaceId: 'space-b',
        },
      ],
    });

    resolveGetAll([
      {
        id: 'stale-report',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 1,
        summary: 'From space A',
        signals: [],
        rawPostCount: { lonely: 1 },
        spaceId: mockSpace.id,
      },
    ]);

    const result = await pending;

    expect(result.success).toBe(true);
    expect(useAppStore.getState().reports).toHaveLength(1);
    expect(useAppStore.getState().reports[0]?.id).toBe('space-b-report');
  });

  it('should keep isGenerating true until all overlapping calls settle', async () => {
    setActiveSpace();
    const resolvers: Array<(value: { data: { success: boolean }; error: null }) => void> = [];
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    const getAllResolvers: Array<(value: unknown[]) => void> = [];
    mockGetAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          getAllResolvers.push(resolve);
        })
    );

    const first = useAppStore.getState().generateReport();
    const second = useAppStore.getState().generateReport();

    expect(useAppStore.getState().isGenerating).toBe(true);
    expect(resolvers).toHaveLength(2);

    resolvers[0]!({ data: { success: true }, error: null });
    await vi.waitFor(() => expect(getAllResolvers).toHaveLength(1));
    resolvers[1]!({ data: { success: true }, error: null });
    await vi.waitFor(() => expect(getAllResolvers).toHaveLength(2));

    // Older refresh settles first with distinct reports; newer must win.
    getAllResolvers[0]!([
      {
        id: 'older-gen',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 1,
        summary: 'Older',
        signals: [],
        rawPostCount: { lonely: 1 },
        spaceId: mockSpace.id,
      },
    ]);
    await first;
    expect(useAppStore.getState().isGenerating).toBe(true);
    expect(useAppStore.getState().reports).toHaveLength(0);

    getAllResolvers[1]!([
      {
        id: 'newer-gen',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 2,
        summary: 'Newer',
        signals: [],
        rawPostCount: { lonely: 2 },
        spaceId: mockSpace.id,
      },
    ]);
    await second;
    expect(useAppStore.getState().isGenerating).toBe(false);
    expect(useAppStore.getState().reports).toHaveLength(1);
    expect(useAppStore.getState().reports[0]?.id).toBe('newer-gen');
  });

  it('should ignore stale generate refresh after A→B→A navigation', async () => {
    setActiveSpace();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    let resolveFirstGetAll: (value: unknown[]) => void = () => {};
    let getAllCalls = 0;
    const freshA = {
      id: 'fresh-a',
      createdAt: new Date().toISOString(),
      dateRange: { from: '', to: '' },
      subreddits: ['lonely'],
      totalPostsAnalyzed: 3,
      summary: 'Fresh A',
      signals: [],
      rawPostCount: { lonely: 3 },
      spaceId: mockSpace.id,
    };
    mockGetAll.mockImplementation(() => {
      getAllCalls += 1;
      if (getAllCalls === 1) {
        return new Promise((resolve) => {
          resolveFirstGetAll = resolve;
        });
      }
      return Promise.resolve([freshA]);
    });

    const firstVisitGenerate = useAppStore.getState().generateReport();
    await vi.waitFor(() => {
      expect(getAllCalls).toBe(1);
    });

    // Navigate A → B → A (bumps navigationEpoch); return visit loads fresher reports.
    useAppStore.getState().setActiveSpace('space-b');
    useAppStore.getState().setActiveSpace(mockSpace.id);
    await vi.waitFor(() => {
      expect(useAppStore.getState().reports[0]?.id).toBe('fresh-a');
    });

    resolveFirstGetAll([
      {
        id: 'stale-a',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 1,
        summary: 'Stale A',
        signals: [],
        rawPostCount: { lonely: 1 },
        spaceId: mockSpace.id,
      },
    ]);
    await firstVisitGenerate;

    expect(useAppStore.getState().reports).toHaveLength(1);
    expect(useAppStore.getState().reports[0]?.id).toBe('fresh-a');
  });

  it('should keep newer reports when the older overlap refresh settles last', async () => {
    setActiveSpace();
    const resolvers: Array<(value: { data: { success: boolean }; error: null }) => void> = [];
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    const getAllResolvers: Array<(value: unknown[]) => void> = [];
    mockGetAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          getAllResolvers.push(resolve);
        })
    );

    const first = useAppStore.getState().generateReport();
    const second = useAppStore.getState().generateReport();

    expect(useAppStore.getState().isGenerating).toBe(true);
    expect(resolvers).toHaveLength(2);

    // Reverse invoke order: second completes (and refreshes) before first.
    resolvers[1]!({ data: { success: true }, error: null });
    await vi.waitFor(() => expect(getAllResolvers).toHaveLength(1));
    getAllResolvers[0]!([
      {
        id: 'newer-gen',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 2,
        summary: 'Newer',
        signals: [],
        rawPostCount: { lonely: 2 },
        spaceId: mockSpace.id,
      },
    ]);
    await second;
    expect(useAppStore.getState().isGenerating).toBe(true);
    expect(useAppStore.getState().reports[0]?.id).toBe('newer-gen');

    resolvers[0]!({ data: { success: true }, error: null });
    await vi.waitFor(() => expect(getAllResolvers).toHaveLength(2));
    getAllResolvers[1]!([
      {
        id: 'older-gen',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 1,
        summary: 'Older',
        signals: [],
        rawPostCount: { lonely: 1 },
        spaceId: mockSpace.id,
      },
    ]);
    await first;
    expect(useAppStore.getState().isGenerating).toBe(false);
    expect(useAppStore.getState().reports).toHaveLength(1);
    expect(useAppStore.getState().reports[0]?.id).toBe('newer-gen');
  });

  it('should not let a late loadReports overwrite generateReport results', async () => {
    setActiveSpace();
    let resolveInitialLoad: (value: unknown[]) => void = () => {};
    let getAllCalls = 0;
    mockGetAll.mockImplementation(() => {
      getAllCalls += 1;
      if (getAllCalls === 1) {
        return new Promise((resolve) => {
          resolveInitialLoad = resolve;
        });
      }
      return Promise.resolve([
        {
          id: 'after-generate',
          createdAt: new Date().toISOString(),
          dateRange: { from: '', to: '' },
          subreddits: ['lonely'],
          totalPostsAnalyzed: 5,
          summary: 'Generated',
          signals: [],
          rawPostCount: { lonely: 5 },
          spaceId: mockSpace.id,
        },
      ]);
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const loadPromise = useAppStore.getState().loadReports();
    await vi.waitFor(() => expect(getAllCalls).toBe(1));

    await useAppStore.getState().generateReport();
    expect(useAppStore.getState().reports[0]?.id).toBe('after-generate');

    resolveInitialLoad([
      {
        id: 'stale-initial',
        createdAt: new Date().toISOString(),
        dateRange: { from: '', to: '' },
        subreddits: ['lonely'],
        totalPostsAnalyzed: 1,
        summary: 'Stale load',
        signals: [],
        rawPostCount: { lonely: 1 },
        spaceId: mockSpace.id,
      },
    ]);
    await loadPromise;

    expect(useAppStore.getState().reports).toHaveLength(1);
    expect(useAppStore.getState().reports[0]?.id).toBe('after-generate');
  });
});

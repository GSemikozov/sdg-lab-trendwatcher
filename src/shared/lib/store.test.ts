import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './store';

const mockSpace = {
  id: 'space-1',
  name: 'Test Space',
  slug: 'test-space',
  description: 'Test description',
  domainPrompt: 'You are a test analyst',
  creativeImagePrompt: '',
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
});

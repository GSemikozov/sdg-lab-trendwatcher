import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { APP_CONFIG } from '@shared/config';
import { getOpenAIAPIKey } from '@shared/config/ai';
import { createAIService, createRedditService, reportStorage } from '@shared/api';
import type { Report, SubredditConfig } from '@shared/lib/types';

interface AppStore {
  reports: Report[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  subreddits: SubredditConfig[];

  loadReports: () => Promise<void>;
  generateReport: () => Promise<{ success: boolean; error?: string; report?: Report }>;
  deleteReport: (id: string) => Promise<void>;
  setSubreddits: (subreddits: SubredditConfig[]) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        reports: [],
        isLoading: false,
        isGenerating: false,
        error: null,
        subreddits: APP_CONFIG.DEFAULT_SUBREDDITS.map((name) => ({
          name,
          enabled: true,
          category: 'core',
        })),

        loadReports: async () => {
          set({ isLoading: true, error: null });
          try {
            const reports = await reportStorage.getAll();
            set({ reports });
          } catch (err) {
            set({ error: 'Failed to load reports from Supabase' });
            console.error('loadReports error:', err);
          } finally {
            set({ isLoading: false });
          }
        },

        generateReport: async () => {
          set({ isGenerating: true, error: null });
          try {
            const { subreddits } = get();
            const enabledSubs = subreddits.filter((s) => s.enabled).map((s) => s.name);
            if (enabledSubs.length === 0) {
              throw new Error('No subreddits enabled');
            }

            const apiKey = getOpenAIAPIKey();
            if (!apiKey) {
              throw new Error('OpenAI API key not configured');
            }

            const redditService = createRedditService();
            const aiService = createAIService(apiKey);

            const posts = await redditService.fetchMultipleSubreddits(enabledSubs);
            if (posts.length === 0) {
              throw new Error(
                'No posts fetched from Reddit. This may be a CORS issue — use the Supabase Edge Function for production.'
              );
            }

            const report = await aiService.analyzeRedditPosts(posts, enabledSubs);

            await reportStorage.save(report);
            set((state) => ({ reports: [report, ...state.reports] }));

            return { success: true, report };
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate report';
            set({ error: message });
            console.error('generateReport error:', err);
            return { success: false, error: message };
          } finally {
            set({ isGenerating: false });
          }
        },

        deleteReport: async (id: string) => {
          try {
            await reportStorage.delete(id);
            set((state) => ({
              reports: state.reports.filter((r) => r.id !== id),
            }));
          } catch (err) {
            console.error('deleteReport error:', err);
          }
        },

        setSubreddits: (subreddits) => set({ subreddits }),
        clearError: () => set({ error: null }),
      }),
      {
        name: 'trendwatcher-store',
        partialize: (state) => ({
          subreddits: state.subreddits,
        }),
      }
    ),
    { name: 'TrendWatcher' }
  )
);

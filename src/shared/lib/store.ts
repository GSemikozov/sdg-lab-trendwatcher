import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { APP_CONFIG } from '@shared/config';
import { reportStorage } from '@shared/api';
import { supabase } from '@shared/api/supabase';
import type { Report, SubredditConfig } from '@shared/lib/types';

interface AppStore {
  reports: Report[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  subreddits: SubredditConfig[];

  loadReports: () => Promise<void>;
  generateReport: () => Promise<{ success: boolean; error?: string }>;
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

            const { data, error } = await supabase.functions.invoke('daily-report', {
              body: { subreddits: enabledSubs },
            });

            if (error) {
              throw new Error(error.message || 'Edge Function call failed');
            }

            if (!data?.success) {
              throw new Error(data?.error || 'Report generation failed');
            }

            const reports = await reportStorage.getAll();
            set({ reports });

            return { success: true };
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

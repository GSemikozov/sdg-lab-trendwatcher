import { loadSettings, reportStorage, saveSettings } from '@shared/api';
import { supabase } from '@shared/api/supabase';
import { APP_CONFIG } from '@shared/config';
import type { Report, SubredditConfig } from '@shared/lib/types';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppStore {
  reports: Report[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  subreddits: SubredditConfig[];
  emailRecipients: string[];
  settingsLoaded: boolean;

  loadReports: () => Promise<void>;
  loadSettings: () => Promise<void>;
  generateReport: () => Promise<{ success: boolean; error?: string }>;
  deleteReport: (id: string) => Promise<void>;
  setSubreddits: (subreddits: SubredditConfig[]) => void;
  setEmailRecipients: (emails: string[]) => void;
  clearError: () => void;
}

async function invokeEdgeFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const functionsUrl = import.meta.env.DEV ? import.meta.env.VITE_FUNCTIONS_URL : undefined;

  if (functionsUrl) {
    const res = await fetch(`${functionsUrl}/daily-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
    return data;
  }

  const { data, error } = await supabase.functions.invoke('daily-report', { body });
  if (error) throw new Error(error.message || 'Edge Function call failed');
  return data;
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
        emailRecipients: [],
        settingsLoaded: false,

        loadSettings: async () => {
          try {
            const settings = await loadSettings();
            if (settings) {
              const subreddits = settings.subreddits.map((name) => ({
                name,
                enabled: true,
                category: 'core',
              }));
              set({ subreddits, emailRecipients: settings.email_recipients, settingsLoaded: true });
            } else {
              set({ settingsLoaded: true });
            }
          } catch (err) {
            console.error('loadSettings error:', err);
            set({ settingsLoaded: true });
          }
        },

        loadReports: async () => {
          const hasCache = get().reports.length > 0;
          if (!hasCache) {
            set({ isLoading: true });
          }
          set({ error: null });
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

            const { emailRecipients } = get();
            const body: Record<string, unknown> = { subreddits: enabledSubs };
            if (emailRecipients.length > 0) {
              body.emailRecipients = emailRecipients;
            }

            const data = await invokeEdgeFunction(body);
            if (!data?.success) {
              throw new Error((data?.error as string) || 'Report generation failed');
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

        setSubreddits: (subreddits) => {
          set({ subreddits });
          const names = subreddits.filter((s) => s.enabled).map((s) => s.name);
          saveSettings({ subreddits: names }).catch((err) =>
            console.error('Failed to sync subreddits:', err)
          );
        },
        setEmailRecipients: (emailRecipients) => {
          set({ emailRecipients });
          saveSettings({ email_recipients: emailRecipients }).catch((err) =>
            console.error('Failed to sync email recipients:', err)
          );
        },
        clearError: () => set({ error: null }),
      }),
      {
        name: 'trendwatcher-store',
        partialize: (state) => ({
          subreddits: state.subreddits,
          emailRecipients: state.emailRecipients,
        }),
      }
    ),
    { name: 'TrendWatcher' }
  )
);

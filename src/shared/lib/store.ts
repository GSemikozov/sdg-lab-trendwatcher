import {
  deleteSpace as apiDeleteSpace,
  updateSpace as apiUpdateSpace,
  loadSpaces,
  reportStorage,
} from '@shared/api';
import { supabase } from '@shared/api/supabase';
import type { Report, Space } from '@shared/lib/types';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppStore {
  spaces: Space[];
  activeSpaceId: string | null;
  reports: Report[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  settingsLoaded: boolean;

  loadSpaces: () => Promise<void>;
  setActiveSpace: (id: string) => void;
  loadReports: () => Promise<void>;
  generateReport: () => Promise<{ success: boolean; error?: string }>;
  deleteReport: (id: string) => Promise<void>;
  removeSpace: (id: string) => Promise<void>;
  updateSpaceSettings: (updates: Partial<Space>) => void;
  clearError: () => void;
}

async function invokeEdgeFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const functionsUrl = import.meta.env.DEV ? import.meta.env.VITE_FUNCTIONS_URL : undefined;

  if (functionsUrl) {
    const anonJwt = (import.meta.env.VITE_SUPABASE_ANON_JWT as string | undefined)?.trim();
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token || anonJwt || anonKey;
    if (!token) {
      throw new Error('Missing Supabase anon JWT for local daily-report auth');
    }
    const res = await fetch(`${functionsUrl}/daily-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: token,
      },
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

function buildReportBody(activeSpaceId: string | null, spaces: Space[]): Record<string, unknown> {
  if (!activeSpaceId) throw new Error('No space selected');

  const space = spaces.find((s) => s.id === activeSpaceId);
  if (!space) throw new Error('Space not found');

  const subreddits = space.subreddits.filter(Boolean);
  if (subreddits.length === 0) throw new Error('No subreddits configured for this space');

  const body: Record<string, unknown> = { space_id: activeSpaceId, subreddits };
  if (space.emailRecipients.length > 0) body.emailRecipients = space.emailRecipients;
  return body;
}

/** Tracks overlapping generateReport() calls so isGenerating stays true until the last one settles. */
let generateReportPending = 0;
/** Bumped on every space navigation — stale in-flight generate/load must not write back. */
let navigationEpoch = 0;
/**
 * Shared reports-write freshness for loadReports + generateReport.
 * Bumped on navigation and when generation starts so a late initial load cannot
 * overwrite a newer generate refresh (and older generates lose to newer ones).
 * Does NOT own isLoading — that uses loadOwnerSeq so generate can invalidate
 * writes without leaving skeletons stuck.
 */
let reportsFreshness = 0;
/** Latest loadReports call; only that owner clears isLoading in finally. */
let loadOwnerSeq = 0;

/** Test-only: reset module guards between cases. */
export function __resetStoreGenerationGuardsForTests() {
  generateReportPending = 0;
  navigationEpoch = 0;
  reportsFreshness = 0;
  loadOwnerSeq = 0;
}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        spaces: [],
        activeSpaceId: null,
        reports: [],
        isLoading: false,
        isGenerating: false,
        error: null,
        settingsLoaded: false,

        loadSpaces: async () => {
          try {
            const spaces = await loadSpaces();
            const currentId = get().activeSpaceId;
            const activeId = spaces.find((s) => s.id === currentId)?.id ?? spaces[0]?.id ?? null;
            set({ spaces, activeSpaceId: activeId, settingsLoaded: true });
          } catch (err) {
            console.error('loadSpaces error:', err);
            set({ settingsLoaded: true });
          }
        },

        setActiveSpace: (id: string) => {
          navigationEpoch += 1;
          reportsFreshness += 1;
          set({ activeSpaceId: id, reports: [] });
          get().loadReports();
        },

        loadReports: async () => {
          const spaceId = get().activeSpaceId;
          if (!spaceId) return;
          const epochAtStart = navigationEpoch;
          const freshnessAtStart = reportsFreshness;
          const ownerAtStart = ++loadOwnerSeq;

          const hasCache = get().reports.length > 0;
          if (!hasCache) {
            set({ isLoading: true });
          }
          set({ error: null });
          try {
            const reports = await reportStorage.getAll(spaceId);
            // Freshness guards writes only — a concurrent generate must not leave skeletons.
            if (
              navigationEpoch === epochAtStart &&
              reportsFreshness === freshnessAtStart &&
              get().activeSpaceId === spaceId
            ) {
              set({ reports });
            }
          } catch (err) {
            if (
              navigationEpoch === epochAtStart &&
              reportsFreshness === freshnessAtStart &&
              get().activeSpaceId === spaceId
            ) {
              set({ error: 'Failed to load reports from Supabase' });
            }
            console.error('loadReports error:', err);
          } finally {
            if (loadOwnerSeq === ownerAtStart && get().activeSpaceId === spaceId) {
              set({ isLoading: false });
            }
          }
        },

        generateReport: async () => {
          generateReportPending += 1;
          // Invalidate in-flight load *writes* (not load ownership / isLoading).
          reportsFreshness += 1;
          set({ isGenerating: true, error: null });
          const spaceIdAtStart = get().activeSpaceId;
          const epochAtStart = navigationEpoch;
          const freshnessAtStart = reportsFreshness;
          const stillCurrent = () =>
            navigationEpoch === epochAtStart &&
            reportsFreshness === freshnessAtStart &&
            get().activeSpaceId === spaceIdAtStart;
          try {
            const { spaces } = get();
            const body = buildReportBody(spaceIdAtStart, spaces);

            const data = await invokeEdgeFunction(body);
            if (!data?.success) {
              throw new Error((data?.error as string) || 'Report generation failed');
            }

            const reports = await reportStorage.getAll(spaceIdAtStart ?? undefined);
            // Navigation (incl. A→B→A), a newer generate, or load invalidation superseded this.
            if (!stillCurrent()) {
              return { success: true };
            }
            set({ reports, isLoading: false });

            return { success: true };
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate report';
            if (stillCurrent()) {
              set({ error: message, isLoading: false });
            }
            console.error('generateReport error:', err);
            return { success: false, error: message };
          } finally {
            generateReportPending = Math.max(0, generateReportPending - 1);
            if (generateReportPending === 0) {
              set({ isGenerating: false });
            }
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

        removeSpace: async (id: string) => {
          await apiDeleteSpace(id);
          const remaining = get().spaces.filter((s) => s.id !== id);
          const newActiveId = remaining[0]?.id ?? null;
          set({ spaces: remaining, activeSpaceId: newActiveId, reports: [] });
          if (newActiveId) get().loadReports();
        },

        updateSpaceSettings: (updates: Partial<Space>) => {
          const { activeSpaceId, spaces } = get();
          if (!activeSpaceId) return;

          const updatedSpaces = spaces.map((s) =>
            s.id === activeSpaceId ? { ...s, ...updates } : s
          );
          set({ spaces: updatedSpaces });

          const dbUpdates: Partial<Space> = {};
          if (updates.subreddits !== undefined) {
            dbUpdates.subreddits = updates.subreddits.map((s) => s.replace(/\/+$/, ''));
          }
          if (updates.emailRecipients !== undefined)
            dbUpdates.emailRecipients = updates.emailRecipients;
          if (updates.domainPrompt !== undefined) dbUpdates.domainPrompt = updates.domainPrompt;
          if (updates.creativePromptTemplate !== undefined)
            dbUpdates.creativePromptTemplate = updates.creativePromptTemplate;
          if (updates.name !== undefined) dbUpdates.name = updates.name;
          if (updates.description !== undefined) dbUpdates.description = updates.description;

          apiUpdateSpace(activeSpaceId, dbUpdates).catch((err) =>
            console.error('Failed to sync space settings:', err)
          );
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: 'trendwatcher-store',
        partialize: (state) => ({
          activeSpaceId: state.activeSpaceId,
        }),
      }
    ),
    { name: 'TrendWatcher' }
  )
);

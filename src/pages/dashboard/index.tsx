import { GenerateReportButton } from '@features/generate-report';
import { generateAggregateReport, loadAggregateReports } from '@shared/api';
import { compareReports } from '@shared/lib/report-diff';
import { useAppStore } from '@shared/lib/store';
import type { AggregateReport, PeriodType, Report } from '@shared/lib/types';
import { Skeleton } from '@shared/ui';
import { AdConceptsSection } from '@widgets/ad-concepts';
import { AggregateReportView } from '@widgets/aggregate-report';
import { ReportCard } from '@widgets/report-card';
import { ReportDiff } from '@widgets/report-diff';
import { SignalList } from '@widgets/signal-list';
import { TrendBoard } from '@widgets/trend-board';
import { BarChart3, CalendarDays, CalendarRange, Layers, Loader2, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

type ViewFilter = 'all' | 'daily' | 'weekly' | 'monthly';

export function SpaceDashboardPage() {
  const { slug } = useParams<{ slug: string }>();

  const spaces = useAppStore((s) => s.spaces);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const activeSpaceId = useAppStore((s) => s.activeSpaceId);
  const setActiveSpace = useAppStore((s) => s.setActiveSpace);
  const reports = useAppStore((s) => s.reports);
  const isLoading = useAppStore((s) => s.isLoading);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const error = useAppStore((s) => s.error);
  const loadReports = useAppStore((s) => s.loadReports);
  const deleteReport = useAppStore((s) => s.deleteReport);
  const clearError = useAppStore((s) => s.clearError);

  const space = spaces.find((s) => s.slug === slug);

  const [filter, setFilter] = useState<ViewFilter>('all');
  const [weeklyReports, setWeeklyReports] = useState<AggregateReport[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<AggregateReport[]>([]);
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState<string | null>(null);
  const [weeklyGenerating, setWeeklyGenerating] = useState(false);
  const [monthlyGenerating, setMonthlyGenerating] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync store with URL slug and load reports
  useEffect(() => {
    if (!space) return;
    if (space.id !== activeSpaceId) {
      setActiveSpace(space.id);
    } else {
      loadReports();
    }
  }, [space?.id]);

  const loadAllAggReports = useCallback(async () => {
    if (!space) return;
    setAggLoading(true);
    setAggError(null);
    try {
      const [weekly, monthly] = await Promise.all([
        loadAggregateReports(space.id, 'week'),
        loadAggregateReports(space.id, 'month'),
      ]);
      setWeeklyReports(weekly);
      setMonthlyReports(monthly);
    } catch (err) {
      setAggError(err instanceof Error ? err.message : 'Failed to load aggregate reports');
    } finally {
      setAggLoading(false);
    }
  }, [space]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load aggregate reports when space is ready
  useEffect(() => {
    if (space && activeSpaceId === space.id) {
      loadAllAggReports();
    }
  }, [space?.id, activeSpaceId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on space change
  useEffect(() => {
    setWeeklyReports([]);
    setMonthlyReports([]);
    setAggError(null);
  }, [activeSpaceId]);

  const handleGenerateAggregate = async (periodType: PeriodType) => {
    if (!space) return;
    const setGenerating = periodType === 'week' ? setWeeklyGenerating : setMonthlyGenerating;
    setGenerating(true);
    setAggError(null);
    try {
      const result = await generateAggregateReport(space.id, periodType);
      if (!result.success) {
        setAggError(result.error ?? 'Generation failed');
      } else {
        await loadAllAggReports();
      }
    } catch (err) {
      setAggError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    if (reports.length > 0 && !selectedReportId) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when space changes
  useEffect(() => {
    setSelectedReportId(null);
  }, [activeSpaceId]);

  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? null;

  const comparison = useMemo(() => {
    if (!selectedReport || reports.length < 2) return null;
    const idx = reports.findIndex((r) => r.id === selectedReportId);
    const previousReport = reports[idx + 1];
    if (!previousReport) return null;
    return compareReports(selectedReport, previousReport);
  }, [selectedReport, selectedReportId, reports]);

  if (!settingsLoaded) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  if (!space) {
    return <Navigate to="/" replace />;
  }

  const hasSubreddits = space.subreddits.length > 0;
  const showDaily = filter === 'all' || filter === 'daily';
  const showWeekly = filter === 'all' || filter === 'weekly';
  const showMonthly = filter === 'all' || filter === 'monthly';

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{space.name}</h2>
          {space.description && (
            <p className="mt-1 text-sm text-muted-foreground">{space.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/spaces/${slug}/settings`}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
          {filter === 'daily' && <GenerateReportButton />}
        </div>
      </div>

      <ViewFilterBar value={filter} onChange={setFilter} />

      {!hasSubreddits && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-signal-medium/30 bg-signal-medium/10 px-4 py-3 text-sm text-signal-medium">
          <span>No subreddits configured for this space — add them in Settings.</span>
          <Link to={`/spaces/${slug}/settings`} className="font-medium hover:underline">
            Go to Settings
          </Link>
        </div>
      )}
      {(error || aggError) && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-signal-high/30 bg-signal-high/10 px-4 py-3 text-sm text-signal-high">
          <span>{error || aggError}</span>
          <button
            type="button"
            onClick={() => { clearError(); setAggError(null); }}
            className="font-medium hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {showDaily && (
        <DailySection
          reports={reports}
          isLoading={isLoading}
          isGenerating={isGenerating}
          selectedReportId={selectedReportId}
          selectedReport={selectedReport}
          comparison={comparison}
          spaceName={space.name}
          onSelectReport={setSelectedReportId}
          onDeleteReport={deleteReport}
          isFirst
          showGenerateButton={filter === 'daily'}
        />
      )}

      {showWeekly && (
        <AggregateSection
          title="Weekly Reports"
          icon={<CalendarDays className="h-5 w-5 text-primary" />}
          reports={weeklyReports}
          isLoading={aggLoading}
          isGenerating={weeklyGenerating}
          periodType="week"
          onGenerate={() => handleGenerateAggregate('week')}
          isFirst={!showDaily}
        />
      )}

      {showMonthly && (
        <AggregateSection
          title="Monthly Reports"
          icon={<CalendarRange className="h-5 w-5 text-primary" />}
          reports={monthlyReports}
          isLoading={aggLoading}
          isGenerating={monthlyGenerating}
          periodType="month"
          onGenerate={() => handleGenerateAggregate('month')}
          isFirst={!showDaily && !showWeekly}
        />
      )}
    </main>
  );
}

function ViewFilterBar({ value, onChange }: { value: ViewFilter; onChange: (v: ViewFilter) => void }) {
  const items: { key: ViewFilter; label: string; icon: typeof BarChart3 }[] = [
    { key: 'all', label: 'All', icon: Layers },
    { key: 'daily', label: 'Daily', icon: BarChart3 },
    { key: 'weekly', label: 'Weekly', icon: CalendarDays },
    { key: 'monthly', label: 'Monthly', icon: CalendarRange },
  ];

  return (
    <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card/50 p-1 w-fit">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function DailySection({
  reports,
  isLoading,
  isGenerating,
  selectedReportId,
  selectedReport,
  comparison,
  spaceName,
  onSelectReport,
  onDeleteReport,
  isFirst = false,
  showGenerateButton,
}: {
  reports: Report[];
  isLoading: boolean;
  isGenerating: boolean;
  selectedReportId: string | null;
  selectedReport: Report | null;
  comparison: ReturnType<typeof compareReports> | null;
  spaceName: string;
  onSelectReport: (id: string) => void;
  onDeleteReport: (id: string) => Promise<void>;
  isFirst?: boolean;
  showGenerateButton: boolean;
}) {
  const generateReport = useAppStore((s) => s.generateReport);

  if (isLoading && !isGenerating) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (reports.length === 0) {
    return <EmptyState spaceName={spaceName} />;
  }

  return (
    <section className={isFirst ? '' : 'mt-10 border-t border-border pt-8'}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Daily Reports</h2>
        </div>
        {showGenerateButton && (
          <button
            type="button"
            onClick={generateReport}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
            {isGenerating ? 'Generating…' : 'Generate daily'}
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History
          </h3>
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isActive={report.id === selectedReportId}
              onSelect={onSelectReport}
              onDelete={onDeleteReport}
            />
          ))}
        </aside>

        <div className="space-y-6">
          {selectedReport ? (
            <>
              <TrendBoard report={selectedReport} />
              <AdConceptsSection concepts={selectedReport.adConcepts} />
              {comparison && <ReportDiff comparison={comparison} />}
              <div>
                <h2 className="mb-3 text-lg font-semibold text-foreground">All Signals</h2>
                <SignalList signals={selectedReport.signals} />
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              Select a report to view details
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AggregateSection({
  title,
  icon,
  reports,
  isLoading,
  isGenerating,
  periodType,
  onGenerate,
  isFirst = false,
}: {
  title: string;
  icon: ReactNode;
  reports: AggregateReport[];
  isLoading: boolean;
  isGenerating: boolean;
  periodType: PeriodType;
  onGenerate: () => void;
  isFirst?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);

  useEffect(() => {
    if (reports.length > 0 && !reports.find((r) => r.id === selectedId)) {
      setSelectedId(reports[0].id);
    }
  }, [reports, selectedId]);

  const selectedReport = reports.find((r) => r.id === selectedId) ?? null;
  const periodLabel = periodType === 'week' ? 'weekly' : 'monthly';

  return (
    <section className={isFirst ? '' : 'mt-10 border-t border-border pt-8'}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-md bg-card border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          {isGenerating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isGenerating ? 'Generating...' : `Generate ${periodType === 'week' ? 'Weekly' : 'Monthly'}`}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {periodLabel} reports yet. They will appear here automatically or you can generate one manually.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedId(report.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                  report.id === selectedId
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-card/80'
                }`}
              >
                <div className="text-sm font-medium text-foreground">
                  {report.periodStart} — {report.periodEnd}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {report.totalPosts} posts · {report.clusterSummaries.length} clusters
                </div>
              </button>
            ))}
          </aside>

          <div>
            {selectedReport ? (
              <AggregateReportView report={selectedReport} />
            ) : (
              <p className="py-12 text-center text-muted-foreground">
                Select a report to view details
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ spaceName }: { spaceName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <BarChart3 className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-foreground">No reports yet</h2>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        Generate your first report for <strong>{spaceName}</strong> to analyze Reddit discussions.
        The system will identify emerging topics, growing trends, pain points, and product
        hypotheses.
      </p>
      <div className="mt-6">
        <GenerateReportButton />
      </div>
    </div>
  );
}

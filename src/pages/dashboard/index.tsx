import { GenerateReportButton } from '@features/generate-report';
import { compareReports } from '@shared/lib/report-diff';
import { useAppStore } from '@shared/lib/store';
import { Skeleton } from '@shared/ui';
import { AdConceptsSection } from '@widgets/ad-concepts';
import { ReportCard } from '@widgets/report-card';
import { ReportDiff } from '@widgets/report-diff';
import { SignalList } from '@widgets/signal-list';
import { TrendBoard } from '@widgets/trend-board';
import { BarChart3, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync store with URL slug and load reports
  useEffect(() => {
    if (!space) return;
    if (space.id !== activeSpaceId) {
      setActiveSpace(space.id);
    } else {
      loadReports();
    }
  }, [space?.id]);

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
          <GenerateReportButton />
        </div>
      </div>

      {!hasSubreddits && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-signal-medium/30 bg-signal-medium/10 px-4 py-3 text-sm text-signal-medium">
          <span>No subreddits configured for this space — add them in Settings.</span>
          <Link to={`/spaces/${slug}/settings`} className="font-medium hover:underline">
            Go to Settings
          </Link>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-signal-high/30 bg-signal-high/10 px-4 py-3 text-sm text-signal-high">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="font-medium hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading && !isGenerating ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState spaceName={space.name} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Report History</h2>
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isActive={report.id === selectedReportId}
                onSelect={setSelectedReportId}
                onDelete={deleteReport}
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
      )}
    </main>
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

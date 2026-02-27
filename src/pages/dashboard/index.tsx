import { GenerateReportButton } from '@features/generate-report';
import { compareReports } from '@shared/lib/report-diff';
import { useAppStore } from '@shared/lib/store';
import { Badge, Skeleton } from '@shared/ui';
import { ReportCard } from '@widgets/report-card';
import { ReportDiff } from '@widgets/report-diff';
import { SignalList } from '@widgets/signal-list';
import { TrendBoard } from '@widgets/trend-board';
import { BarChart3, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const reports = useAppStore((s) => s.reports);
  const isLoading = useAppStore((s) => s.isLoading);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const error = useAppStore((s) => s.error);
  const loadReports = useAppStore((s) => s.loadReports);
  const deleteReport = useAppStore((s) => s.deleteReport);
  const clearError = useAppStore((s) => s.clearError);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (reports.length > 0 && !selectedReportId) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? null;

  const comparison = useMemo(() => {
    if (!selectedReport || reports.length < 2) return null;
    const idx = reports.findIndex((r) => r.id === selectedReportId);
    const previousReport = reports[idx + 1];
    if (!previousReport) return null;
    return compareReports(selectedReport, previousReport);
  }, [selectedReport, selectedReportId, reports]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">TrendWatcher</h1>
              <p className="text-xs text-muted-foreground">SDG Lab signal intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info">MVP</Badge>
            <Link
              to="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <GenerateReportButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {!useAppStore((s) => s.subreddits.some((sub) => sub.enabled)) && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-signal-medium/30 bg-signal-medium/10 px-4 py-3 text-sm text-signal-medium">
            <span>No subreddits enabled — configure at least one to generate reports.</span>
            <Link to="/settings" className="font-medium hover:underline">
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
          <EmptyState />
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <BarChart3 className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-foreground">No reports yet</h2>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        Generate your first report to analyze Reddit discussions across loneliness, depression, and
        social skills communities. The system will identify emerging topics, growing trends, pain
        points, and product hypotheses.
      </p>
      <div className="mt-6">
        <GenerateReportButton />
      </div>
    </div>
  );
}

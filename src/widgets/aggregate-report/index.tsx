import type { AggregateReport } from '@shared/lib/types';
import { AdConceptsSection } from '@widgets/ad-concepts';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import { Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AggregateReportViewProps {
  report: AggregateReport;
}

export function AggregateReportView({ report }: AggregateReportViewProps) {
  const periodLabel = report.periodType === 'week' ? 'Weekly' : 'Monthly';
  const dateRange = `${report.periodStart} — ${report.periodEnd}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{periodLabel} Summary</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateRange} · {report.totalPosts} posts analyzed
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">{report.summary}</p>
        </CardContent>
      </Card>

      <AdConceptsSection concepts={report.creativeConcepts} />

      {report.clusterSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Topic Clusters</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Themes identified from {report.totalPosts} posts
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.clusterSummaries.map((cluster) => (
                <ClusterCard key={cluster.index} cluster={cluster} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: AggregateReport['clusterSummaries'][number] }) {
  const changeStr = cluster.change ?? 'stable';
  const isGrowing = changeStr.startsWith('+');
  const isShrinking = changeStr.startsWith('-');

  return (
    <div className="rounded-lg border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{cluster.label}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={
            isGrowing
              ? 'text-green-500 font-medium'
              : isShrinking
                ? 'text-red-500 font-medium'
                : 'text-muted-foreground'
          }>
            {isGrowing ? (
              <TrendingUp className="inline h-3 w-3 mr-0.5" />
            ) : isShrinking ? (
              <TrendingDown className="inline h-3 w-3 mr-0.5" />
            ) : (
              <Minus className="inline h-3 w-3 mr-0.5" />
            )}
            {changeStr}
          </span>
          <span className="text-muted-foreground">{cluster.size} posts</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{cluster.description}</p>
    </div>
  );
}

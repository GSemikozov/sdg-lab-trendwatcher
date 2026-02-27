import { cn } from '@shared/lib/cn';
import type { ReportComparison } from '@shared/lib/report-diff';
import type { SignalStrength } from '@shared/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import {
  ArrowDown,
  ArrowUp,
  GitCompareArrows,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface ReportDiffProps {
  comparison: ReportComparison;
}

const strengthLabel: Record<SignalStrength, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
};

const strengthColor: Record<SignalStrength, string> = {
  high: 'text-signal-high',
  medium: 'text-signal-medium',
  low: 'text-signal-low',
};

export function ReportDiff({ comparison }: ReportDiffProps) {
  const { newSignals, goneSignals, strengthened, weakened, postCountDelta, postCountPercent } =
    comparison;

  const hasChanges =
    newSignals.length > 0 ||
    goneSignals.length > 0 ||
    strengthened.length > 0 ||
    weakened.length > 0;

  if (!hasChanges && postCountDelta === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5 text-primary" />
          <CardTitle>Changes vs Previous Report</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {postCountDelta !== 0 && (
          <div className="flex items-center gap-2 text-sm">
            {postCountDelta > 0 ? (
              <TrendingUp className="h-4 w-4 text-trend-up" />
            ) : (
              <TrendingDown className="h-4 w-4 text-signal-high" />
            )}
            <span className="text-muted-foreground">
              Post volume:{' '}
              <span
                className={cn(
                  'font-medium',
                  postCountDelta > 0 ? 'text-trend-up' : 'text-signal-high'
                )}
              >
                {postCountDelta > 0 ? '+' : ''}
                {postCountDelta} ({postCountPercent > 0 ? '+' : ''}
                {postCountPercent}%)
              </span>
            </span>
          </div>
        )}

        {newSignals.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-trend-new">
              <Plus className="h-3.5 w-3.5" />
              New signals ({newSignals.length})
            </h4>
            <div className="space-y-1.5">
              {newSignals.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-trend-new/20 bg-trend-new/5 px-3 py-2"
                >
                  <span className="text-sm text-foreground">{s.title}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      strengthColor[s.strength]
                    )}
                  >
                    {s.strength}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {strengthened.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-signal-high">
              <ArrowUp className="h-3.5 w-3.5" />
              Intensified ({strengthened.length})
            </h4>
            <div className="space-y-1.5">
              {strengthened.map(({ signal, from }) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between rounded-md border border-signal-high/20 bg-signal-high/5 px-3 py-2"
                >
                  <span className="text-sm text-foreground">{signal.title}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={strengthColor[from]}>{strengthLabel[from]}</span>
                    <ArrowUp className="h-3 w-3 text-signal-high" />
                    <span className={strengthColor[signal.strength]}>
                      {strengthLabel[signal.strength]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {weakened.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-trend-up">
              <ArrowDown className="h-3.5 w-3.5" />
              Weakened ({weakened.length})
            </h4>
            <div className="space-y-1.5">
              {weakened.map(({ signal, from }) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="text-sm text-foreground">{signal.title}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={strengthColor[from]}>{strengthLabel[from]}</span>
                    <ArrowDown className="h-3 w-3 text-trend-up" />
                    <span className={strengthColor[signal.strength]}>
                      {strengthLabel[signal.strength]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {goneSignals.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Minus className="h-3.5 w-3.5" />
              No longer detected ({goneSignals.length})
            </h4>
            <div className="space-y-1.5">
              {goneSignals.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2 opacity-60"
                >
                  <span className="text-sm text-muted-foreground line-through">{s.title}</span>
                  <span className="text-xs text-muted-foreground">{s.category.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

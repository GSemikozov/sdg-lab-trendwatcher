import { cn } from '@shared/lib/cn';
import type { Signal } from '@shared/lib/types';
import { AlertTriangle, ArrowUpRight, Lightbulb, Sparkles, TrendingUp } from 'lucide-react';

const categoryConfig: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  emerging_topic: { icon: Sparkles, label: 'New Topic', color: 'text-trend-new' },
  growing_trend: { icon: TrendingUp, label: 'Growing', color: 'text-trend-up' },
  pain_point: { icon: AlertTriangle, label: 'Pain Point', color: 'text-signal-high' },
  hypothesis: { icon: Lightbulb, label: 'Hypothesis', color: 'text-primary' },
};

const strengthColors: Record<string, string> = {
  high: 'bg-signal-high/15 text-signal-high border-signal-high/30',
  medium: 'bg-signal-medium/15 text-signal-medium border-signal-medium/30',
  low: 'bg-signal-low/15 text-signal-low border-signal-low/30',
};

const sentimentColors: Record<string, string> = {
  positive: 'text-trend-up',
  negative: 'text-signal-high',
  mixed: 'text-signal-medium',
  neutral: 'text-muted-foreground',
};

interface SignalCardProps {
  signal: Signal;
  className?: string;
}

export function SignalCard({ signal, className }: SignalCardProps) {
  const config = categoryConfig[signal.category] ?? categoryConfig.emerging_topic;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Icon className={cn('h-4 w-4', config.color)} />
          <span className={cn('font-medium', config.color)}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {signal.growthPercent != null && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-trend-up">
              <ArrowUpRight className="h-3 w-3" />+{signal.growthPercent}%
            </span>
          )}
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium',
              strengthColors[signal.strength]
            )}
          >
            {signal.strength}
          </span>
        </div>
      </div>

      <h3 className="mt-2 font-semibold text-foreground">{signal.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{signal.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {signal.postCount > 0 && <span>{signal.postCount} posts</span>}
        <span className={sentimentColors[signal.sentiment]}>{signal.sentiment} sentiment</span>
        <div className="flex gap-1">
          {signal.subreddits.map((sub) => (
            <span
              key={sub}
              className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
            >
              r/{sub}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

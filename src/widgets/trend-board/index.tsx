import { SignalCard } from '@entities/signal';
import type { Report, SignalCategory } from '@shared/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui';
import {
  AlertTriangle,
  BarChart3,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface TrendBoardProps {
  report: Report;
}

const sectionConfig: {
  category: SignalCategory;
  title: string;
  icon: typeof Sparkles;
  description: string;
}[] = [
  {
    category: 'emerging_topic',
    title: 'New Emerging Topics',
    icon: Sparkles,
    description: 'Themes appearing for the first time or gaining initial traction',
  },
  {
    category: 'growing_trend',
    title: 'Growing Trends',
    icon: TrendingUp,
    description: 'Topics accelerating compared to baseline',
  },
  {
    category: 'pain_point',
    title: 'Pain Points',
    icon: AlertTriangle,
    description: 'User frustrations and unmet needs',
  },
  {
    category: 'hypothesis',
    title: 'Product Hypotheses',
    icon: Lightbulb,
    description: 'Actionable product ideas derived from signals',
  },
];

export function TrendBoard({ report }: TrendBoardProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
          <CardDescription>
            {report.totalPostsAnalyzed} posts analyzed across{' '}
            {report.subreddits.map((s) => `r/${s}`).join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-foreground">{report.summary}</p>

          <div className="mt-4 flex flex-wrap gap-4">
            {Object.entries(report.rawPostCount).map(([sub, count]) => (
              <div key={sub} className="rounded-lg bg-secondary px-3 py-2">
                <span className="text-xs text-muted-foreground">r/{sub}</span>
                <p className="text-lg font-semibold text-foreground">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {sectionConfig.map(({ category, title, icon: Icon, description }) => {
        const signals = report.signals.filter((s) => s.category === category);
        if (signals.length === 0) return null;

        return (
          <div key={category}>
            <div className="mb-3 flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold text-foreground">{title}</h2>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

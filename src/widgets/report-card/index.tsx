import type { Report } from '@shared/lib/types';
import { cn } from '@shared/lib/cn';
import { Badge, Card, CardContent } from '@shared/ui';
import { format } from 'date-fns';
import {
  Calendar,
  FileText,
  Trash2,
} from 'lucide-react';

interface ReportCardProps {
  report: Report;
  isActive?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReportCard({ report, isActive, onSelect, onDelete }: ReportCardProps) {
  const signalsByCategory = report.signals.reduce(
    (acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/40',
        isActive && 'border-primary ring-1 ring-primary/20'
      )}
      onClick={() => onSelect(report.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(report.id);
            }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {report.totalPostsAnalyzed} posts
          </span>
          <span className="text-xs text-muted-foreground">
            {report.subreddits.map((s) => `r/${s}`).join(', ')}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {report.summary}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {signalsByCategory.emerging_topic && (
            <Badge variant="info">{signalsByCategory.emerging_topic} new</Badge>
          )}
          {signalsByCategory.growing_trend && (
            <Badge variant="success">{signalsByCategory.growing_trend} growing</Badge>
          )}
          {signalsByCategory.pain_point && (
            <Badge variant="danger">{signalsByCategory.pain_point} pains</Badge>
          )}
          {signalsByCategory.hypothesis && (
            <Badge variant="warning">{signalsByCategory.hypothesis} ideas</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

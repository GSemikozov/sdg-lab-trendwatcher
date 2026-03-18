import { useAppStore } from '@shared/lib/store';
import { Button } from '@shared/ui';
import { FileText } from 'lucide-react';

export function GenerateReportButton() {
  const isGenerating = useAppStore((s) => s.isGenerating);
  const generateReport = useAppStore((s) => s.generateReport);
  const activeSpace = useAppStore((s) => s.spaces.find((sp) => sp.id === s.activeSpaceId));
  const hasSubreddits = (activeSpace?.subreddits.length ?? 0) > 0;

  return (
    <Button
      onClick={generateReport}
      loading={isGenerating}
      disabled={!hasSubreddits}
      size="lg"
      className="gap-2 whitespace-nowrap"
      title={hasSubreddits ? undefined : 'Configure subreddits for this space in Settings'}
    >
      <FileText className="h-4 w-4" />
      {isGenerating ? 'Analyzing...' : 'Generate daily report'}
    </Button>
  );
}

import { Button } from '@shared/ui';
import { useAppStore } from '@shared/lib/store';
import { FileText } from 'lucide-react';

export function GenerateReportButton() {
  const isGenerating = useAppStore((s) => s.isGenerating);
  const generateReport = useAppStore((s) => s.generateReport);
  const hasEnabled = useAppStore((s) => s.subreddits.some((sub) => sub.enabled));

  return (
    <Button
      onClick={generateReport}
      loading={isGenerating}
      disabled={!hasEnabled}
      size="lg"
      className="gap-2"
      title={hasEnabled ? undefined : 'Enable at least one subreddit in Settings'}
    >
      <FileText className="h-4 w-4" />
      {isGenerating ? 'Analyzing...' : 'Generate Report'}
    </Button>
  );
}

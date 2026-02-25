import { Button } from '@shared/ui';
import { useAppStore } from '@shared/lib/store';
import { FileText } from 'lucide-react';

export function GenerateReportButton() {
  const isGenerating = useAppStore((s) => s.isGenerating);
  const generateReport = useAppStore((s) => s.generateReport);

  return (
    <Button
      onClick={generateReport}
      loading={isGenerating}
      size="lg"
      className="gap-2"
    >
      <FileText className="h-4 w-4" />
      {isGenerating ? 'Analyzing...' : 'Generate Report'}
    </Button>
  );
}

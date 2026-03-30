import type { AdConcept, AggregateReport, ClusterSummary, PeriodType, Signal } from '@shared/lib/types';
import { supabase } from './supabase';

interface AggregateRow {
  id: string;
  space_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  summary: string;
  creative_concepts: AdConcept[];
  cluster_summaries: ClusterSummary[];
  total_posts: number;
  created_at: string;
  growing_trends?: Signal[];
  pain_points?: Signal[];
  product_hypotheses?: Signal[];
}

function rowToAggregate(row: AggregateRow): AggregateReport {
  return {
    id: row.id,
    spaceId: row.space_id,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summary: row.summary,
    growingTrends: row.growing_trends ?? [],
    painPoints: row.pain_points ?? [],
    productHypotheses: row.product_hypotheses ?? [],
    creativeConcepts: row.creative_concepts ?? [],
    clusterSummaries: row.cluster_summaries ?? [],
    totalPosts: row.total_posts,
    createdAt: row.created_at,
  };
}

export async function loadAggregateReports(
  spaceId: string,
  periodType: PeriodType,
): Promise<AggregateReport[]> {
  const { data, error } = await supabase
    .from('aggregate_reports')
    .select('*')
    .eq('space_id', spaceId)
    .eq('period_type', periodType)
    .order('period_start', { ascending: false })
    .limit(12);

  if (error) throw new Error(`Failed to load aggregate reports: ${error.message}`);
  return (data as AggregateRow[]).map(rowToAggregate);
}

export async function generateAggregateReport(
  spaceId: string,
  periodType: PeriodType,
): Promise<{ success: boolean; error?: string }> {
  // Weekly: use backfill (daily reports) — works without embeddings/clusters.
  // Monthly: use weekly-report (cluster-based) — requires embeddings.
  const fn = periodType === 'week' ? 'weekly-report-backfill-daily' : 'weekly-report';
  // Long timeout: Edge Function waits until all Drive creatives (10 per concept) finish.
  const { data, error } = await supabase.functions.invoke(fn, {
    body: periodType === 'week' ? { space_id: spaceId } : { space_id: spaceId, period_type: periodType },
    timeout: 1_200_000,
  });

  if (error) throw new Error(error.message || 'Report function failed');
  if (!data?.success) {
    const spaces = data?.spaces as { error?: string }[] | undefined;
    const firstError = spaces?.[0]?.error;
    return { success: false, error: firstError ?? 'Report generation failed' };
  }
  return { success: true };
}

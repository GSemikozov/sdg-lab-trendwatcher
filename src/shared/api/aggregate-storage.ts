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

export interface CreativeParams {
  space_id: string;
  space_name: string;
  period_start: string;
  concepts: { title: string; description: string }[];
  date_folder_id: string;
  concept_folder_ids: string[];
  creative_prompt_template: string;
}

export async function generateAggregateReport(
  _spaceId: string,
  _periodType: PeriodType,
): Promise<{ success: boolean; error?: string; creativeParams?: CreativeParams }> {
  return { success: false, error: 'Service is temporarily unavailable' };
}

const IMAGES_PER_CONCEPT = 10;
const BATCH_SIZE = 5;
const MAX_STAGNANT = 6;

export async function fillCreativesFromClient(
  params: CreativeParams,
  onProgress?: (completedConcepts: number, totalConcepts: number, totalImages: number) => void,
): Promise<void> {
  const total = params.concepts.length;
  const perConcept = new Array<number>(total).fill(0);
  let done = 0;

  const notify = () => {
    const totalImages = perConcept.reduce((a, b) => a + b, 0);
    onProgress?.(done, total, totalImages);
  };

  const fillOne = async (ci: number) => {
    let fileIndex = 0;
    let stagnant = 0;

    while (fileIndex < IMAGES_PER_CONCEPT && stagnant < MAX_STAGNANT) {
      const count = Math.min(BATCH_SIZE, IMAGES_PER_CONCEPT - fileIndex);

      try {
        const { data, error } = await supabase.functions.invoke('generate-creatives', {
          body: {
            space_id: params.space_id,
            space_name: params.space_name,
            period_start: params.period_start,
            concept_index: ci,
            concepts: params.concepts,
            image_offset: fileIndex,
            image_count: count,
            creative_prompt_template: params.creative_prompt_template,
            ...(params.date_folder_id ? { date_folder_id: params.date_folder_id } : {}),
            ...(params.concept_folder_ids[ci] ? { concept_folder_id: params.concept_folder_ids[ci] } : {}),
          },
        });

        if (error) {
          console.error(`[fillCreatives] concept ${ci} error:`, error);
          stagnant++;
          continue;
        }

        const added = data?.images_uploaded ?? 0;
        fileIndex = typeof data?.next_file_index === 'number' ? data.next_file_index : fileIndex + added;

        if (added === 0) {
          stagnant++;
        } else {
          stagnant = 0;
        }
      } catch (e) {
        console.error(`[fillCreatives] concept ${ci}:`, e);
        stagnant++;
      }

      perConcept[ci] = fileIndex;
      notify();
    }

    perConcept[ci] = fileIndex;
    done++;
    notify();
  };

  await Promise.all(params.concepts.map((_, ci) => fillOne(ci)));
}

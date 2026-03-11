import type { AdConcept, Report, Signal } from '@shared/lib/types';
import { supabase } from './supabase';

export interface ReportStorage {
  save(report: Report): Promise<void>;
  getAll(spaceId?: string): Promise<Report[]>;
  getById(id: string): Promise<Report | null>;
  getLatest(spaceId?: string): Promise<Report | null>;
  delete(id: string): Promise<void>;
}

interface ReportRow {
  id: string;
  created_at: string;
  date_from: string;
  date_to: string;
  subreddits: string[];
  total_posts_analyzed: number;
  summary: string;
  signals: Signal[];
  ad_concepts?: AdConcept[];
  raw_post_count: Record<string, number>;
  space_id?: string;
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    createdAt: row.created_at,
    dateRange: { from: row.date_from, to: row.date_to },
    subreddits: row.subreddits,
    totalPostsAnalyzed: row.total_posts_analyzed,
    summary: row.summary,
    signals: row.signals,
    adConcepts: row.ad_concepts,
    rawPostCount: row.raw_post_count,
    spaceId: row.space_id,
  };
}

function reportToRow(report: Report) {
  return {
    id: report.id,
    created_at: report.createdAt,
    date_from: report.dateRange.from,
    date_to: report.dateRange.to,
    subreddits: report.subreddits,
    total_posts_analyzed: report.totalPostsAnalyzed,
    summary: report.summary,
    signals: report.signals,
    ad_concepts: report.adConcepts,
    raw_post_count: report.rawPostCount,
    space_id: report.spaceId,
  };
}

export class SupabaseReportStorage implements ReportStorage {
  async save(report: Report): Promise<void> {
    const { error } = await supabase.from('reports').insert(reportToRow(report));
    if (error) throw new Error(`Failed to save report: ${error.message}`);
  }

  async getAll(spaceId?: string): Promise<Report[]> {
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false });

    if (spaceId) {
      query = query.eq('space_id', spaceId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load reports: ${error.message}`);
    return (data as ReportRow[]).map(rowToReport);
  }

  async getById(id: string): Promise<Report | null> {
    const { data, error } = await supabase.from('reports').select('*').eq('id', id).single();

    if (error) return null;
    return rowToReport(data as ReportRow);
  }

  async getLatest(spaceId?: string): Promise<Report | null> {
    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (spaceId) {
      query = query.eq('space_id', spaceId);
    }

    const { data, error } = await query.single();

    if (error) return null;
    return rowToReport(data as ReportRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete report: ${error.message}`);
  }
}

export const reportStorage = new SupabaseReportStorage();

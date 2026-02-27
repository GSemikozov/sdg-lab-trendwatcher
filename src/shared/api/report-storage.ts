import type { Report, Signal } from '@shared/lib/types';
import { supabase } from './supabase';

export interface ReportStorage {
  save(report: Report): Promise<void>;
  getAll(): Promise<Report[]>;
  getById(id: string): Promise<Report | null>;
  getLatest(): Promise<Report | null>;
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
  raw_post_count: Record<string, number>;
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
    rawPostCount: row.raw_post_count,
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
    raw_post_count: report.rawPostCount,
  };
}

export class SupabaseReportStorage implements ReportStorage {
  async save(report: Report): Promise<void> {
    const { error } = await supabase.from('reports').insert(reportToRow(report));
    if (error) throw new Error(`Failed to save report: ${error.message}`);
  }

  async getAll(): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load reports: ${error.message}`);
    return (data as ReportRow[]).map(rowToReport);
  }

  async getById(id: string): Promise<Report | null> {
    const { data, error } = await supabase.from('reports').select('*').eq('id', id).single();

    if (error) return null;
    return rowToReport(data as ReportRow);
  }

  async getLatest(): Promise<Report | null> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return rowToReport(data as ReportRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete report: ${error.message}`);
  }
}

export const reportStorage = new SupabaseReportStorage();

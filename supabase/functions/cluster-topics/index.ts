/**
 * Supabase Edge Function: cluster-topics
 *
 * Clusters Reddit post embeddings into weekly topic clusters per space.
 * This function is additive and does NOT affect daily reports.
 *
 * Usage:
 * - Manual HTTP POST with JSON body:
 *   { "space_id": "<uuid>", "period_type": "week", "period_start": "2026-02-23" }
 *
 * If period_start is omitted, the function will default to the previous full week
 * (Mon–Sun in UTC) for the given period_type = "week".
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbeddingRow {
  id: string;
  space_id: string;
  subreddit: string;
  post_id: string;
  posted_at: string;
  content: string;
  embedding: number[];
}

interface ClusterInput {
  vector: number[];
  payload: EmbeddingRow;
}

interface Cluster {
  centroid: number[];
  items: EmbeddingRow[];
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function addVec(a: number[], b: number[]): number[] {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < out.length; i++) {
    out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  }
  return out;
}

function scaleVec(a: number[], s: number): number[] {
  return a.map((v) => v * s);
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 1;
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function kMeans(inputs: ClusterInput[], k: number, iterations = 10): Cluster[] {
  if (inputs.length === 0) return [];
  const actualK = Math.min(k, inputs.length);

  // Initialize centroids with first K points (simple and deterministic).
  let centroids: number[][] = inputs.slice(0, actualK).map((x) => x.vector);

  for (let iter = 0; iter < iterations; iter++) {
    const buckets: ClusterInput[][] = Array.from({ length: actualK }, () => []);
    for (const item of inputs) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const dist = cosineDistance(item.vector, centroids[i]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      buckets[bestIdx].push(item);
    }

    const newCentroids: number[][] = [];
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.length === 0) {
        newCentroids.push(centroids[i]);
        continue;
      }
      let sum = new Array(bucket[0].vector.length).fill(0);
      for (const item of bucket) {
        sum = addVec(sum, item.vector);
      }
      newCentroids.push(scaleVec(sum, 1 / bucket.length));
    }
    centroids = newCentroids;
  }

  const clusters: Cluster[] = Array.from({ length: actualK }, (_, i) => ({
    centroid: centroids[i],
    items: [],
  }));

  for (const item of inputs) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const dist = cosineDistance(item.vector, centroids[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    clusters[bestIdx].items.push(item.payload);
  }

  // Filter out empty clusters.
  return clusters.filter((c) => c.items.length > 0);
}

function getDefaultWeek(): { start: string; end: string } {
  const now = new Date();
  // previous full week (Mon–Sun) in UTC
  const day = now.getUTCDay(); // 0..6, 0=Sun
  const diffToLastMonday = ((day + 6) % 7) + 7; // days since last Monday + 7 days
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - diffToLastMonday + 7); // last Sunday
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6); // Monday
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyText = await req.text();
    const body = parseJson<{
      space_id?: string;
      period_type?: 'week' | 'month';
      period_start?: string;
      period_end?: string;
    }>(bodyText) ?? {};

    const spaceId = body.space_id;
    if (!spaceId) {
      return new Response(JSON.stringify({ error: 'space_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const periodType: 'week' | 'month' = body.period_type ?? 'week';

    let periodStart = body.period_start;
    let periodEnd = body.period_end;
    if (!periodStart || !periodEnd) {
      if (periodType === 'week') {
        const w = getDefaultWeek();
        periodStart = w.start;
        periodEnd = w.end;
      } else {
        const now = new Date();
        const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const lastDay = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
        );
        periodStart = firstDay.toISOString().slice(0, 10);
        periodEnd = lastDay.toISOString().slice(0, 10);
      }
    }

    console.log(
      `[cluster-topics] space=${spaceId}, type=${periodType}, start=${periodStart}, end=${periodEnd}`,
    );

    // Fetch embeddings for this space and period (inclusive).
    const from = `${periodStart}T00:00:00Z`;
    const to = `${periodEnd}T23:59:59Z`;

    const embRes = await fetch(
      `${supabaseUrl}/rest/v1/post_embeddings?space_id=eq.${spaceId}&posted_at=gte.${from}&posted_at=lte.${to}&select=id,space_id,subreddit,post_id,posted_at,content,embedding`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );

    if (!embRes.ok) {
      const txt = await embRes.text().catch(() => '');
      console.error('[cluster-topics] Failed to fetch embeddings', embRes.status, txt);
      return new Response(JSON.stringify({ error: 'Failed to fetch embeddings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = (await embRes.json()) as EmbeddingRow[];

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No embeddings found for this period' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // PostgREST returns pgvector columns as strings like "[0.1,0.2,...]"
    function parseEmbedding(raw: unknown): number[] | null {
      if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    }

    const inputs: ClusterInput[] = rows
      .map((r) => {
        const vec = parseEmbedding(r.embedding);
        return vec ? { vector: vec, payload: { ...r, embedding: vec } } : null;
      })
      .filter((x): x is ClusterInput => x !== null);

    if (inputs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No valid embeddings to cluster' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const k = Math.min(5, Math.max(2, Math.floor(Math.sqrt(inputs.length))));
    console.log(`[cluster-topics] Clustering ${inputs.length} embeddings into k=${k}`);

    const clusters = kMeans(inputs, k, 8);
    console.log(
      `[cluster-topics] Produced ${clusters.length} clusters, sizes: ${clusters
        .map((c) => c.items.length)
        .join(', ')}`,
    );

    // Prepare upsert payload for topic_clusters.
    const clusterPayload = clusters.map((c, idx) => {
      // Take top 5 posts by recency as representatives.
      const topItems = [...c.items]
        .sort(
          (a, b) =>
            new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
        )
        .slice(0, 5);
      return {
        space_id: spaceId,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        cluster_index: idx,
        centroid: c.centroid,
        size: c.items.length,
        top_post_ids: topItems.map((i) => i.post_id),
      };
    });

    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/topic_clusters?on_conflict=space_id,period_type,period_start,cluster_index`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify(clusterPayload),
      },
    );

    if (!upsertRes.ok) {
      const txt = await upsertRes.text().catch(() => '');
      console.error('[cluster-topics] Failed to upsert topic_clusters', upsertRes.status, txt);
      return new Response(JSON.stringify({ error: 'Failed to upsert clusters' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        space_id: spaceId,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        clusters: clusters.map((c) => ({ size: c.items.length })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[cluster-topics] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


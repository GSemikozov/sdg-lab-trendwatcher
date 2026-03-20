/**
 * Supabase Edge Function: weekly-report-backfill-daily
 *
 * One-time backfill to generate a "Weekly" aggregate report using the already
 * stored daily reports (table: public.reports).
 *
 * This is intended for the scenario where embeddings/topic_clusters were added
 * later, so weekly/monthly based on clusters may initially be incomplete.
 *
 * Inputs (all optional):
 * - space_id: string (if omitted, processes all active spaces)
 * - period_start: YYYY-MM-DD (if omitted, uses previous week Mon-Sun in UTC)
 * - period_end: YYYY-MM-DD (if omitted, uses previous week Mon-Sun in UTC)
 *
 * Output:
 * - { success: boolean, spaces: [...] }
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const OPENAI_BASE = 'https://api.openai.com/v1';
const BREVO_BASE = 'https://api.brevo.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PeriodType = 'week' | 'month';

interface SpaceConfig {
  id: string;
  name: string;
  domain_prompt: string;
  email_recipients: string[];
}

interface DailyReportRow {
  id: string;
  date_from: string;
  date_to: string;
  summary: string;
  signals: Signal[];
  ad_concepts: { title: string; description: string }[] | null;
  total_posts_analyzed: number;
}

type SignalStrength = 'high' | 'medium' | 'low';
type SentimentType = 'positive' | 'negative' | 'mixed' | 'neutral';
type SignalCategory = 'emerging_topic' | 'growing_trend' | 'pain_point' | 'hypothesis';

interface Signal {
  id?: string;
  category: SignalCategory;
  title: string;
  description: string;
  strength: SignalStrength;
  sentiment: SentimentType;
  postCount: number;
  subreddits: string[];
  growthPercent?: number;
}

interface ClusterSummary {
  index: number;
  label: string;
  size: number;
  change: string;
  description: string;
}

interface AdConcept {
  title: string;
  description: string;
}

function parseBody(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getPreviousWeek(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const diffToLastMonday = ((day + 6) % 7) + 7;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - diffToLastMonday + 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function buildBackfillPrompt(domainPrompt: string): string {
  const base = `You are generating a weekly trend report for a startup.
Your job: synthesize weekly insights from already-generated DAILY TrendWatcher reports.

Return JSON with this exact structure:
{
  "summary": "3-5 sentence executive summary. Must be specific and must explain what changed during the week. Mention dominant themes, what grew, and what became a bigger pain point.",
  "creative_concepts": [
    {
      "title": "Short name of the creative concept",
      "description": "2-3 sentences. Emotional hook + target audience + what visual/story direction for Meta ads works. Must be grounded in daily report content."
    }
  ],
  "cluster_summaries": []
}

Rules:
- Use ONLY information present in the provided daily reports (summaries, signals, and ad_concepts).
- Do not invent new themes.
- Creative concepts must be actionable and non-generic.
- creative_concepts length: 3-5.`;

  if (domainPrompt.trim()) {
    return `${domainPrompt.trim()}\n\n${base}`;
  }
  return `You are a general trend analyst.\n\n${base}`;
}

async function analyzeWithOpenAI(opts: {
  domainPrompt: string;
  dailyReports: DailyReportRow[];
  periodStart: string;
  periodEnd: string;
  openaiKey: string;
}): Promise<{ summary: string; creative_concepts: AdConcept[]; cluster_summaries: ClusterSummary[] }> {
  const { domainPrompt, dailyReports, periodStart, periodEnd, openaiKey } = opts;

  const dailyText = dailyReports
    .map((r, idx) => {
      const concepts = (r.ad_concepts ?? []).slice(0, 3);
      return `Daily report #${idx + 1} (${r.date_from}..${r.date_to})
Summary:
${r.summary}
Top ad concepts (optional):
${concepts
  .map((c) => `- ${c.title}: ${c.description}`)
  .join('\n')}`;
    })
    .join('\n\n---\n\n');

  const userMessage = `Synthesize a weekly report for ${periodStart}..${periodEnd}.

Here are the daily reports:
${dailyText}`;

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildBackfillPrompt(domainPrompt) },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.35,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as {
    summary: string;
    creative_concepts: AdConcept[];
    cluster_summaries: ClusterSummary[];
  };
}

function buildEmailHtml(args: {
  summary: string;
  creativeConcepts: AdConcept[];
  growingTrends: Signal[];
  painPoints: Signal[];
  productHypotheses: Signal[];
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  spaceName: string;
}): string {
  const periodLabel = args.periodType === 'week' ? 'Weekly' : 'Monthly';
  const dateRange = `${args.periodStart} — ${args.periodEnd}`;

  const strengthColor: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  };

  function renderSignalSection(title: string, emoji: string, signals: Signal[]): string {
    if (!signals || signals.length === 0) return '';

    const items = signals
      .map(
        (s) => `
      <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:600;color:#fafafa;">${s.title}</span>
          <span style="background:${strengthColor[s.strength] ?? '#71717a'}22;color:${
          strengthColor[s.strength] ?? '#71717a'
        };padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${s.strength}</span>
        </div>
        <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0 0 8px;">${s.description}</p>
        <div style="font-size:12px;color:#71717a;">
          ${s.growthPercent != null ? `<span style="color:#22c55e;font-weight:600;">+${s.growthPercent}%</span> · ` : ''}${
          s.postCount > 0 ? `${s.postCount} posts · ` : ''
        }${s.sentiment} · ${s.subreddits.map((r) => `r/${r}`).join(', ')}
        </div>
      </div>
    `,
      )
      .join('');

    return `
  <div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">${emoji} ${title}</h2>
    ${items}
  </div>`;
  }

  const conceptsSection =
    args.creativeConcepts.length === 0
      ? ''
      : `
  <div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">🎯 Creative Concepts</h2>
    ${args.creativeConcepts
      .slice(0, 5)
      .map(
        (c) => `
      <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;margin-bottom:10px;">
        <div style="font-weight:600;color:#fafafa;margin-bottom:4px;">${c.title}</div>
        <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0;">${c.description}</p>
      </div>
    `,
      )
      .join('')}
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,system-ui,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#8b5cf6;font-size:24px;margin:0;">📊 ${periodLabel} TrendWatcher Report</h1>
    <p style="color:#a78bfa;font-size:14px;margin:4px 0 0;font-weight:600;">${args.spaceName}</p>
    <p style="color:#71717a;font-size:14px;margin:8px 0 0;">${dateRange}</p>
  </div>

  <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 8px;">${periodLabel} Summary</h2>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">${args.summary}</p>
  </div>

  ${conceptsSection}

  ${renderSignalSection('GROWING TRENDS', '📈', args.growingTrends)}
  ${renderSignalSection('PAIN POINTS', '😰', args.painPoints)}
  ${renderSignalSection('PRODUCT HYPOTHESES', '💡', args.productHypotheses)}

  <div style="text-align:center;padding-top:24px;border-top:1px solid #27272a;">
    <p style="color:#52525b;font-size:12px;margin:0;">TrendWatcher · ${args.spaceName} · ${periodLabel} Report</p>
  </div>
</div>
</body></html>`;
}

async function sendEmail(args: {
  html: string;
  recipients: string[];
  apiKey: string;
  senderEmail: string;
  spaceName: string;
  periodType: PeriodType;
  periodStart: string;
}): Promise<void> {
  const periodLabel = args.periodType === 'week' ? 'Weekly' : 'Monthly';

  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: 'POST',
    headers: { 'api-key': args.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'TrendWatcher', email: args.senderEmail },
      to: args.recipients.map((email) => ({ email })),
      subject: `📊 ${args.spaceName} — ${periodLabel} Report — ${args.periodStart}`,
      htmlContent: args.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
}

async function loadActiveSpaces(supabaseUrl: string, supabaseKey: string): Promise<SpaceConfig[]> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/spaces?is_active=eq.true&select=id,name,domain_prompt,subreddits,email_recipients`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as SpaceConfig[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('EMAIL_SENDER') ?? 'trendwatcher@sdglab.dev';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing env vars (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyText = await req.text();
    const body = parseBody(bodyText);

    const periodType: PeriodType = 'week';

    const prev = getPreviousWeek();
    const periodStart = typeof body.period_start === 'string' ? body.period_start : prev.start;
    const periodEnd = typeof body.period_end === 'string' ? body.period_end : prev.end;

    const requestSpaceId = typeof body.space_id === 'string' ? body.space_id : undefined;

    const spaces: SpaceConfig[] = [];
    if (requestSpaceId) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/spaces?id=eq.${requestSpaceId}&select=id,name,domain_prompt,subreddits,email_recipients`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      if (res.ok) {
        spaces.push(...((await res.json()) as SpaceConfig[]));
      }
    } else {
      spaces.push(...(await loadActiveSpaces(supabaseUrl, supabaseKey)));
    }

    if (spaces.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No spaces found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const periodStartTs = `${periodStart}T00:00:00Z`;
    const periodEndTs = `${periodEnd}T23:59:59Z`;

    const results: { spaceId: string; spaceName: string; success: boolean; error?: string }[] = [];

    for (const space of spaces) {
      try {
        // Load daily reports within the period.
        // Daily reports use a rolling window (last 48h), so their date_from/date_to
        // usually overlap the target week rather than being fully contained.
        // We therefore use an overlap filter:
        // - report ends after week start
        // - report starts before week end
        const reportsRes = await fetch(
          `${supabaseUrl}/rest/v1/reports?space_id=eq.${space.id}&date_to=gte.${encodeURIComponent(periodStartTs)}&date_from=lte.${encodeURIComponent(periodEndTs)}&select=id,date_from,date_to,summary,signals,ad_concepts,total_posts_analyzed&order=created_at.desc`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
        );

        if (!reportsRes.ok) {
          const txt = await reportsRes.text().catch(() => '');
          throw new Error(`Failed to fetch daily reports: ${reportsRes.status} ${txt}`);
        }

        const dailyReports = (await reportsRes.json()) as DailyReportRow[];
        if (dailyReports.length === 0) {
          results.push({ spaceId: space.id, spaceName: space.name, success: false, error: 'No daily reports for this period' });
          continue;
        }

        // Aggregate daily signals into weekly structured sections.
        // We reuse the already-generated daily signals to keep the weekly format consistent with daily reports.
        const allSignals = dailyReports.flatMap((r) => (r.signals ?? []) as Signal[]);
        const strengthRank: Record<SignalStrength, number> = { high: 3, medium: 2, low: 1 };

        function selectTopSignals(category: SignalCategory, limit: number): Signal[] {
          const bucket = allSignals
            .filter((s) => s.category === category)
            .slice();

          // Deduplicate by title, preferring higher strength then higher postCount.
          bucket.sort((a, b) => {
            const dr = (strengthRank[b.strength] ?? 0) - (strengthRank[a.strength] ?? 0);
            if (dr !== 0) return dr;
            return (b.postCount ?? 0) - (a.postCount ?? 0);
          });

          const seen = new Set<string>();
          const out: Signal[] = [];

          for (const s of bucket) {
            const key = `${s.category}:${s.title}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              ...s,
              id: s.id ?? crypto.randomUUID(),
            });
            if (out.length >= limit) break;
          }

          return out;
        }

        const growingTrends = selectTopSignals('growing_trend', 5);
        const painPoints = selectTopSignals('pain_point', 5);
        const productHypotheses = selectTopSignals('hypothesis', 5);

        const analysis = await analyzeWithOpenAI({
          domainPrompt: space.domain_prompt,
          dailyReports,
          periodStart,
          periodEnd,
          openaiKey,
        });

        const totalPosts = dailyReports.reduce((acc, r) => acc + (r.total_posts_analyzed ?? 0), 0);

        const upsertPayload = {
          space_id: space.id,
          period_type: periodType,
          period_start: periodStart,
          period_end: periodEnd,
          summary: analysis.summary,
          growing_trends: growingTrends,
          pain_points: painPoints,
          product_hypotheses: productHypotheses,
          creative_concepts: analysis.creative_concepts ?? [],
          cluster_summaries: [],
          total_posts: totalPosts,
        };

        const upsertRes = await fetch(
          `${supabaseUrl}/rest/v1/aggregate_reports?on_conflict=space_id,period_type,period_start`,
          {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(upsertPayload),
          },
        );

        if (!upsertRes.ok) {
          const txt = await upsertRes.text().catch(() => '');
          throw new Error(`Failed to save aggregate report: ${upsertRes.status} ${txt}`);
        }

        if (brevoKey && space.email_recipients.length > 0) {
          try {
            const html = buildEmailHtml({
              summary: analysis.summary,
              creativeConcepts: analysis.creative_concepts ?? [],
              growingTrends,
              painPoints,
              productHypotheses,
              periodType,
              periodStart,
              periodEnd,
              spaceName: space.name,
            });
            await sendEmail({
              html,
              recipients: space.email_recipients,
              apiKey: brevoKey,
              senderEmail,
              spaceName: space.name,
              periodType,
              periodStart,
            });
          } catch (emailErr) {
            // Non-blocking
            console.error(`[weekly-report-backfill-daily:${space.name}] email failed:`, emailErr);
          }
        }

        // Create Drive folders once, then trigger generate-creatives per concept (avoids duplicates)
        const concepts = analysis.creative_concepts ?? [];
        if (concepts.length > 0) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (supabaseUrl && supabaseKey) {
            const genUrl = `${supabaseUrl}/functions/v1/generate-creatives`;
            // Create folder structure once to avoid race (5 parallel calls each creating "SDG Lab")
            let dateFolderId: string | undefined;
            try {
              const folderRes = await fetch(genUrl, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  space_name: space.name,
                  period_start: periodStart,
                  create_folders_only: true,
                }),
              });
              if (folderRes.ok) {
                const folderData = (await folderRes.json()) as { date_folder_id?: string };
                dateFolderId = folderData.date_folder_id;
              }
            } catch (folderErr) {
              console.error(`[weekly-report-backfill-daily:${space.name}] create folders failed:`, folderErr);
            }
            const payload = (conceptIdx: number, imageOffset: number, imageCount: number) => ({
              space_id: space.id,
              space_name: space.name,
              period_start: periodStart,
              concept_index: conceptIdx,
              concepts,
              image_offset: imageOffset,
              image_count: imageCount,
              ...(dateFolderId ? { date_folder_id: dateFolderId } : {}),
            });
            // 10 images per concept = 2 batches of 5 (avoids timeout)
            const BATCH_SIZE = 5;
            const BATCHES_PER_CONCEPT = 2;
            let creativesError: string | undefined;
            try {
              const firstRes = await fetch(genUrl, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload(0, 0, BATCH_SIZE)),
              });
              const firstBody = await firstRes.text();
              if (!firstRes.ok) {
                let errMsg = firstBody;
                try {
                  const parsed = JSON.parse(firstBody) as { error?: string };
                  if (parsed?.error) errMsg = parsed.error;
                } catch {
                  errMsg = firstBody.slice(0, 200);
                }
                creativesError = errMsg;
                console.error(`[weekly-report-backfill-daily:${space.name}] generate-creatives failed:`, creativesError);
              }
            } catch (firstErr) {
              creativesError = firstErr instanceof Error ? firstErr.message : String(firstErr);
              console.error(`[weekly-report-backfill-daily:${space.name}] generate-creatives 0 error:`, firstErr);
            }
            for (let i = 0; i < concepts.length; i++) {
              for (let b = 0; b < BATCHES_PER_CONCEPT; b++) {
                if (i === 0 && b === 0) continue; // already awaited
                const offset = b * BATCH_SIZE;
                fetch(genUrl, {
                  method: 'POST',
                  headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload(i, offset, BATCH_SIZE)),
                }).catch((err) => console.error(`[weekly-report-backfill-daily:${space.name}] generate-creatives ${i} batch ${b} failed:`, err));
              }
            }
            console.log(`[weekly-report-backfill-daily:${space.name}] Triggered generate-creatives: ${concepts.length} concepts × ${BATCHES_PER_CONCEPT} batches = 10 images each`);
            if (creativesError) {
              results.push({
                spaceId: space.id,
                spaceName: space.name,
                success: false,
                error: creativesError,
              });
            } else {
              results.push({ spaceId: space.id, spaceName: space.name, success: true });
            }
          } else {
            results.push({ spaceId: space.id, spaceName: space.name, success: true });
          }
        } else {
          results.push({ spaceId: space.id, spaceName: space.name, success: true });
        }
      } catch (err) {
        console.error(`[weekly-report-backfill-daily:${space.name}] Error:`, err);
        results.push({
          spaceId: space.id,
          spaceName: space.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return new Response(JSON.stringify({ success: results.some((r) => r.success), spaces: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


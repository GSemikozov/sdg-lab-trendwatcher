/**
 * Supabase Edge Function: weekly-report
 *
 * Generates aggregate (weekly or monthly) reports per space.
 * Reads topic_clusters + representative posts, sends to OpenAI for summary + creative concepts,
 * saves to aggregate_reports, and optionally sends email via Brevo.
 *
 * Usage:
 *   POST { "space_id": "<uuid>", "period_type": "week" | "month" }
 *   POST {} — processes all active spaces for the previous week (cron mode).
 */

const OPENAI_BASE = 'https://api.openai.com/v1';
const BREVO_BASE = 'https://api.brevo.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EdgeGlobal = typeof globalThis & {
  EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
};

function edgeRuntimeWaitUntil(promise: Promise<unknown>): void {
  const eg = globalThis as EdgeGlobal;
  if (eg.EdgeRuntime?.waitUntil) eg.EdgeRuntime.waitUntil(promise);
  else void promise;
}

interface SpaceConfig {
  id: string;
  name: string;
  domain_prompt: string;
  creative_image_prompt?: string;
  creative_prompt_template?: string;
  subreddits: string[];
  email_recipients: string[];
}

interface ClusterRow {
  cluster_index: number;
  size: number;
  top_post_ids: string[];
}

interface PostRow {
  post_id: string;
  subreddit: string;
  content: string;
  posted_at: string;
}

interface AdConcept {
  title: string;
  description: string;
}

interface WeeklySignal {
  category: string;
  title: string;
  description: string;
  strength: string;
  sentiment: string;
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

// --- Period helpers ---

function getPreviousWeek(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToLastMonday = ((day + 6) % 7) + 7;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - diffToLastMonday + 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function getPreviousMonth(): { start: string; end: string } {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
}

function getPreviousPeriod(
  periodType: 'week' | 'month',
  periodStart: string,
): { start: string; end: string } {
  const d = new Date(periodStart + 'T00:00:00Z');
  if (periodType === 'week') {
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const prevMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const prevEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
  return { start: prevMonth.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) };
}

// --- Supabase helpers ---

async function supaFetch(
  supabaseUrl: string,
  supabaseKey: string,
  path: string,
): Promise<Response> {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
}

// --- OpenAI ---

function buildWeeklyPrompt(domainPrompt: string, periodType: string): string {
  const base = `You are generating a ${periodType}ly trend report. Your job: synthesize topic clusters from Reddit discussions into an executive summary and actionable creative concepts.

Return JSON with this exact structure:
{
  "summary": "3-5 sentence executive summary for this ${periodType}. Focus on: what themes dominated, what is new, and what changed vs the previous ${periodType}. Do NOT repeat all bullets below — highlight only the most important insights.",
  "growing_trends": [
    {
      "category": "growing_trend",
      "title": "Short descriptive title (5-8 words)",
      "description": "What is growing and why it matters for product/marketing decisions. Reference specific cluster(s) and post patterns.",
      "strength": "high" | "medium" | "low",
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "postCount": number of posts supporting this trend,
      "subreddits": ["which subreddits"],
      "growthPercent": estimated growth vs normal volume (null if unknown)
    }
  ],
  "pain_points": [
    {
      "category": "pain_point",
      "title": "Short descriptive title (5-8 words)",
      "description": "The concrete recurring frustration or unmet need users describe, in their own language where possible. Explain why it matters.",
      "strength": "high" | "medium" | "low",
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "postCount": number of posts supporting this pain point,
      "subreddits": ["which subreddits"],
      "growthPercent": estimated growth vs normal volume (null if unknown)
    }
  ],
  "product_hypotheses": [
    {
      "category": "hypothesis",
      "title": "Short name of the hypothesis (5-8 words)",
      "description": "Concrete product/feature/experiment idea explicitly linked to at least one growing trend or pain point above. Format: 'Because users report [pain/trend], a product that [solution] could [outcome].'",
      "strength": "high" | "medium" | "low",
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "postCount": number of posts this hypothesis is grounded in,
      "subreddits": ["which subreddits"],
      "growthPercent": estimated growth vs normal volume (null if unknown)
    }
  ],
  "cluster_summaries": [
    {
      "index": 0,
      "label": "Short human-readable cluster name (3-6 words)",
      "size": number of posts in this cluster,
      "change": "+15%" or "-10%" or "new" or "stable" compared to previous ${periodType},
      "description": "1-2 sentences: what this cluster is about and why it matters for product/marketing decisions."
    }
  ],
  "creative_concepts": [
    {
      "title": "Short name of the creative concept",
      "description": "2-3 sentences: the emotional hook, the problem it targets, what visual/story direction works for Meta ads. Must be grounded in the clusters above — reference which cluster inspired it."
    }
  ]
}

Guidelines:
- Summary should highlight what CHANGED this ${periodType} vs last, but keep it high-level. Detailed GROWING TRENDS, PAIN POINTS and PRODUCT HYPOTHESES must live in the dedicated arrays above.
- Cluster summaries: label each cluster with a human-readable theme name. Estimate change vs previous ${periodType}.
- Creative concepts: 3-5 concepts, each linked to specific clusters. Think Meta ads (feed/reels/stories). Prioritize the most actionable and differentiated.
- Be concrete. "Late-night loneliness peaks on Sundays" > "People feel lonely sometimes."
- When writing PAIN POINTS and PRODUCT HYPOTHESES, stay close to the language users actually use in the example posts and comments.
- 3-7 items in each of growing_trends, pain_points, product_hypotheses is enough; prioritize by impact and clarity.`;

  if (domainPrompt.trim()) {
    return `${domainPrompt.trim()}\n\n${base}`;
  }
  return `You are a general trend analyst.\n\n${base}`;
}

async function analyzeWithOpenAI(
  clusters: { index: number; size: number; posts: PostRow[] }[],
  prevClusters: { index: number; size: number }[] | null,
  domainPrompt: string,
  periodType: string,
  periodLabel: string,
  openaiKey: string,
): Promise<{
  summary: string;
  growing_trends?: WeeklySignal[];
  pain_points?: WeeklySignal[];
  product_hypotheses?: WeeklySignal[];
  cluster_summaries: ClusterSummary[];
  creative_concepts: AdConcept[];
}> {
  const clusterText = clusters
    .map((c) => {
      const postsText = c.posts
        .map((p) => `  [r/${p.subreddit}] ${p.content.slice(0, 200)}`)
        .join('\n');
      return `Cluster ${c.index} (${c.size} posts):\n${postsText}`;
    })
    .join('\n\n');

  const prevText = prevClusters
    ? `\nPrevious ${periodType} cluster sizes: ${prevClusters.map((c) => `#${c.index}:${c.size}`).join(', ')}`
    : '\nNo previous period data available for comparison.';

  const userMessage = `Analyze ${periodLabel} clusters:\n\n${clusterText}${prevText}`;

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
        { role: 'system', content: buildWeeklyPrompt(domainPrompt, periodType) },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// --- Email ---

function buildEmailHtml(
  summary: string,
  growingTrends: WeeklySignal[],
  painPoints: WeeklySignal[],
  productHypotheses: WeeklySignal[],
  clusterSummaries: ClusterSummary[],
  concepts: AdConcept[],
  periodType: string,
  periodStart: string,
  periodEnd: string,
  spaceName: string,
): string {
  const periodLabel = periodType === 'week' ? 'Weekly' : 'Monthly';
  const dateRange = `${periodStart} — ${periodEnd}`;

  const strengthColor: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  };

  function renderSignalSection(
    title: string,
    emoji: string,
    signals: WeeklySignal[],
  ): string {
    if (!signals || signals.length === 0) return '';

    const items = signals
      .map(
        (s) => `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:600;color:#fafafa;">${s.title}</span>
        <span style="background:${strengthColor[s.strength] ?? '#71717a'}22;color:${strengthColor[s.strength] ?? '#71717a'};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${s.strength}</span>
      </div>
      <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0 0 8px;">${s.description}</p>
      <div style="font-size:12px;color:#71717a;">
        ${s.growthPercent ? `<span style="color:#22c55e;font-weight:600;">+${s.growthPercent}%</span> · ` : ''}${s.postCount > 0 ? `${s.postCount} posts · ` : ''}${s.sentiment} · ${s.subreddits
          .map((r) => `r/${r}`)
          .join(', ')}
      </div>
    </div>`,
      )
      .join('');

    return `
  <div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">${emoji} ${title}</h2>
    ${items}
  </div>`;
  }

  const clusterCards = clusterSummaries
    .map(
      (c) => `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:600;color:#fafafa;">${c.label}</span>
        <span style="font-size:12px;color:${c.change.startsWith('+') ? '#22c55e' : c.change.startsWith('-') ? '#ef4444' : '#a1a1aa'};">${c.change} · ${c.size} posts</span>
      </div>
      <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0;">${c.description}</p>
    </div>`,
    )
    .join('');

  const conceptCards = concepts
    .slice(0, 5)
    .map(
      (c) => `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-weight:600;color:#fafafa;margin-bottom:4px;">${c.title}</div>
      <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0;">${c.description}</p>
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,system-ui,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#8b5cf6;font-size:24px;margin:0;">📊 ${periodLabel} TrendWatcher Report</h1>
    <p style="color:#a78bfa;font-size:14px;margin:4px 0 0;font-weight:600;">${spaceName}</p>
    <p style="color:#71717a;font-size:14px;margin:8px 0 0;">${dateRange}</p>
  </div>

  <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 8px;">${periodLabel} Summary</h2>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">${summary}</p>
  </div>

  ${renderSignalSection('GROWING TRENDS', '📈', growingTrends)}
  ${renderSignalSection('PAIN POINTS', '😰', painPoints)}
  ${renderSignalSection('PRODUCT HYPOTHESES', '💡', productHypotheses)}

  ${
    conceptCards
      ? `<div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">🎯 Creative Concepts</h2>
    ${conceptCards}
  </div>`
      : ''
  }

  ${
    clusterCards
      ? `<div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">📦 Topic Clusters</h2>
    ${clusterCards}
  </div>`
      : ''
  }

  <div style="text-align:center;padding-top:24px;border-top:1px solid #27272a;">
    <p style="color:#52525b;font-size:12px;margin:0;">TrendWatcher · ${spaceName} · ${periodLabel} Report</p>
  </div>
</div></body></html>`;
}

async function sendEmail(
  html: string,
  recipients: string[],
  apiKey: string,
  senderEmail: string,
  spaceName: string,
  periodType: string,
  periodStart: string,
): Promise<void> {
  const periodLabel = periodType === 'week' ? 'Weekly' : 'Monthly';

  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'TrendWatcher', email: senderEmail },
      to: recipients.map((email) => ({ email })),
      subject: `📊 ${spaceName} — ${periodLabel} Report — ${periodStart}`,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
}

// --- Process one space ---

async function processSpace(
  space: SpaceConfig,
  periodType: 'week' | 'month',
  periodStart: string,
  periodEnd: string,
  openaiKey: string,
  brevoKey: string | undefined,
  senderEmail: string,
  supabaseUrl: string,
  supabaseKey: string,
  fnAuthKey: string,
): Promise<{ spaceId: string; spaceName: string; success: boolean; error?: string }> {
  console.log(
    `[weekly-report:${space.name}] ${periodType} ${periodStart}..${periodEnd}`,
  );

  // 1. Fetch clusters for current period
  const clustersRes = await supaFetch(
    supabaseUrl,
    supabaseKey,
    `topic_clusters?space_id=eq.${space.id}&period_type=eq.${periodType}&period_start=eq.${periodStart}&select=cluster_index,size,top_post_ids&order=cluster_index.asc`,
  );

  if (!clustersRes.ok) {
    const txt = await clustersRes.text().catch(() => '');
    return { spaceId: space.id, spaceName: space.name, success: false, error: `Failed to fetch clusters: ${txt}` };
  }

  const clusterRows = (await clustersRes.json()) as ClusterRow[];

  if (clusterRows.length === 0) {
    // No clusters yet — try to run cluster-topics first
    console.log(`[weekly-report:${space.name}] No clusters found, triggering cluster-topics`);

    const clusterFnRes = await fetch(`${supabaseUrl}/functions/v1/cluster-topics`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${fnAuthKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        space_id: space.id,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
      }),
    });

    if (!clusterFnRes.ok) {
      const txt = await clusterFnRes.text().catch(() => '');
      return { spaceId: space.id, spaceName: space.name, success: false, error: `cluster-topics failed: ${txt}` };
    }

    const clusterResult = await clusterFnRes.json();
    if (!clusterResult.success) {
      return { spaceId: space.id, spaceName: space.name, success: false, error: clusterResult.message ?? 'No embeddings to cluster' };
    }

    // Re-fetch clusters
    const retryRes = await supaFetch(
      supabaseUrl,
      supabaseKey,
      `topic_clusters?space_id=eq.${space.id}&period_type=eq.${periodType}&period_start=eq.${periodStart}&select=cluster_index,size,top_post_ids&order=cluster_index.asc`,
    );
    if (retryRes.ok) {
      const rows = await retryRes.json();
      clusterRows.push(...(rows as ClusterRow[]));
    }
  }

  if (clusterRows.length === 0) {
    return { spaceId: space.id, spaceName: space.name, success: false, error: 'No clusters available after retry' };
  }

  // 2. Fetch representative posts for each cluster
  const allPostIds = clusterRows.flatMap((c) => c.top_post_ids);
  const uniquePostIds = [...new Set(allPostIds)];

  let postMap: Record<string, PostRow> = {};
  if (uniquePostIds.length > 0) {
    const postsRes = await supaFetch(
      supabaseUrl,
      supabaseKey,
      `post_embeddings?space_id=eq.${space.id}&post_id=in.(${uniquePostIds.map((id) => `"${id}"`).join(',')})&select=post_id,subreddit,content,posted_at`,
    );
    if (postsRes.ok) {
      const posts = (await postsRes.json()) as PostRow[];
      for (const p of posts) {
        postMap[p.post_id] = p;
      }
    }
  }

  const clustersWithPosts = clusterRows.map((c) => ({
    index: c.cluster_index,
    size: c.size,
    posts: c.top_post_ids.map((id) => postMap[id]).filter(Boolean),
  }));

  // 3. Fetch previous period clusters for comparison
  const prev = getPreviousPeriod(periodType, periodStart);
  const prevClustersRes = await supaFetch(
    supabaseUrl,
    supabaseKey,
    `topic_clusters?space_id=eq.${space.id}&period_type=eq.${periodType}&period_start=eq.${prev.start}&select=cluster_index,size&order=cluster_index.asc`,
  );
  let prevClusters: { index: number; size: number }[] | null = null;
  if (prevClustersRes.ok) {
    const rows = (await prevClustersRes.json()) as { cluster_index: number; size: number }[];
    if (rows.length > 0) {
      prevClusters = rows.map((r) => ({ index: r.cluster_index, size: r.size }));
    }
  }

  // 4. Total posts count for this period
  const totalPosts = clusterRows.reduce((acc, c) => acc + c.size, 0);

  // 5. OpenAI analysis
  const periodLabel = `${periodType} (${periodStart} to ${periodEnd})`;
  console.log(`[weekly-report:${space.name}] Analyzing ${clusterRows.length} clusters, ${totalPosts} posts`);

  const analysis = await analyzeWithOpenAI(
    clustersWithPosts,
    prevClusters,
    space.domain_prompt,
    periodType,
    periodLabel,
    openaiKey,
  );

  // 6. Save to aggregate_reports (upsert)
  const report = {
    space_id: space.id,
    period_type: periodType,
    period_start: periodStart,
    period_end: periodEnd,
    summary: analysis.summary,
    growing_trends: analysis.growing_trends ?? [],
    pain_points: analysis.pain_points ?? [],
    product_hypotheses: analysis.product_hypotheses ?? [],
    creative_concepts: analysis.creative_concepts ?? [],
    cluster_summaries: analysis.cluster_summaries ?? [],
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
      body: JSON.stringify(report),
    },
  );

  if (!upsertRes.ok) {
    const txt = await upsertRes.text().catch(() => '');
    console.error(`[weekly-report:${space.name}] DB save error:`, txt);
  } else {
    console.log(`[weekly-report:${space.name}] Report saved to aggregate_reports`);
  }

  // 7. Send email
  if (brevoKey && space.email_recipients.length > 0) {
    try {
      const html = buildEmailHtml(
        analysis.summary,
        analysis.growing_trends ?? [],
        analysis.pain_points ?? [],
        analysis.product_hypotheses ?? [],
        analysis.cluster_summaries ?? [],
        analysis.creative_concepts ?? [],
        periodType,
        periodStart,
        periodEnd,
        space.name,
      );
      await sendEmail(
        html,
        space.email_recipients,
        brevoKey,
        senderEmail,
        space.name,
        periodType,
        periodStart,
      );
      console.log(`[weekly-report:${space.name}] Email sent to ${space.email_recipients.join(', ')}`);
    } catch (err) {
      console.error(`[weekly-report:${space.name}] Email failed (non-blocking):`, err);
    }
  }

  // 8. Create Drive folders once, then fire-and-forget generate-creatives per concept (avoids duplicates)
  const concepts = analysis.creative_concepts ?? [];
  if (concepts.length > 0) {
    const genUrl = `${supabaseUrl}/functions/v1/generate-creatives`;
    let dateFolderId: string | undefined;
    let conceptFolderIds: string[] = [];
    try {
      const folderRes = await fetch(genUrl, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${fnAuthKey}`,
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
      if (dateFolderId) {
        const cfRes = await fetch(genUrl, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${fnAuthKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            space_name: space.name,
            period_start: periodStart,
            date_folder_id: dateFolderId,
            concepts,
            create_concept_folders_only: true,
          }),
        });
        if (cfRes.ok) {
          const cfData = (await cfRes.json()) as { concept_folder_ids?: string[] };
          conceptFolderIds = cfData.concept_folder_ids ?? [];
        }
      }
    } catch (folderErr) {
      console.error(`[weekly-report:${space.name}] create folders failed:`, folderErr);
    }
    const promptTemplate = space.creative_prompt_template ?? '';
    const BATCHES: [number, number][] = [[0, 4], [4, 3], [7, 3]];
    const logP = `[weekly-report:${space.name}]`;
    const bodyFor = (i: number, offset: number, count: number) =>
      JSON.stringify({
        space_id: space.id,
        space_name: space.name,
        period_start: periodStart,
        concept_index: i,
        concepts,
        image_offset: offset,
        image_count: count,
        creative_prompt_template: promptTemplate,
        ...(dateFolderId ? { date_folder_id: dateFolderId } : {}),
        ...(conceptFolderIds[i] ? { concept_folder_id: conceptFolderIds[i] } : {}),
      });

    const work = (async () => {
      await Promise.all(
        concepts.map(async (_, conceptIdx) => {
          for (let b = 0; b < BATCHES.length; b++) {
            const [offset, count] = BATCHES[b];
            try {
              const res = await fetch(genUrl, {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${fnAuthKey}`,
                  'Content-Type': 'application/json',
                },
                body: bodyFor(conceptIdx, offset, count),
              });
              const text = await res.text();
              if (!res.ok) {
                console.error(`${logP} concept ${conceptIdx} batch ${b} HTTP ${res.status}:`, text.slice(0, 500));
              } else {
                try {
                  const j = JSON.parse(text) as { partial?: boolean; images_uploaded?: number; images_expected?: number };
                  if (j.partial) {
                    console.warn(
                      `${logP} concept ${conceptIdx} batch ${b} partial: ${j.images_uploaded}/${j.images_expected}`,
                    );
                  }
                } catch {
                  /* ignore */
                }
              }
            } catch (e) {
              console.error(`${logP} concept ${conceptIdx} batch ${b}:`, e);
            }
          }
        }),
      );
    })();
    edgeRuntimeWaitUntil(work);
    console.log(`[weekly-report:${space.name}] Triggered generate-creatives: ${concepts.length} concepts × 3 batches = 10 images each`);
  }

  return { spaceId: space.id, spaceName: space.name, success: true };
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('EMAIL_SENDER') ?? 'trendwatcher@sdglab.dev';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // Legacy JWT key for Edge Function-to-Edge Function calls (gateway rejects sb_secret_* format)
    const fnAuthKey = Deno.env.get('SERVICE_ROLE_JWT') ?? supabaseKey;

    if (!openaiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required env vars (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let requestSpaceId: string | undefined;
    let periodType: 'week' | 'month' = 'week';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        requestSpaceId = body.space_id;
        if (body.period_type === 'month') periodType = 'month';
      } catch {
        // empty body — cron mode
      }
    }

    const period =
      periodType === 'week' ? getPreviousWeek() : getPreviousMonth();

    // Build spaces list
    const spacesToProcess: SpaceConfig[] = [];

    if (requestSpaceId) {
      const res = await supaFetch(
        supabaseUrl,
        supabaseKey,
        `spaces?id=eq.${requestSpaceId}&select=id,name,domain_prompt,creative_image_prompt,creative_prompt_template,subreddits,email_recipients`,
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) spacesToProcess.push(rows[0] as SpaceConfig);
      }
    } else {
      const res = await supaFetch(
        supabaseUrl,
        supabaseKey,
        'spaces?is_active=eq.true&select=id,name,domain_prompt,creative_image_prompt,creative_prompt_template,subreddits,email_recipients&order=created_at.asc',
      );
      if (res.ok) {
        spacesToProcess.push(...((await res.json()) as SpaceConfig[]));
      }
    }

    if (spacesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No spaces found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(
      `[weekly-report] Processing ${spacesToProcess.length} space(s) for ${periodType} ${period.start}..${period.end}`,
    );

    const results = [];
    for (const space of spacesToProcess) {
      try {
        const result = await processSpace(
          space,
          periodType,
          period.start,
          period.end,
          openaiKey,
          brevoKey,
          senderEmail,
          supabaseUrl,
          supabaseKey,
          fnAuthKey,
        );
        results.push(result);
      } catch (err) {
        console.error(`[weekly-report:${space.name}] Fatal error:`, err);
        results.push({
          spaceId: space.id,
          spaceName: space.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({ success: results.some((r) => r.success), spaces: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[weekly-report] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * Supabase Edge Function: daily-report
 *
 * Triggered by pg_cron (daily) or manual HTTP call.
 * Supports multi-space: each space has its own subreddits, recipients, and domain prompt.
 *
 * Manual call: POST with { space_id, subreddits?, emailRecipients? }
 * Cron call: POST with empty body → processes ALL active spaces sequentially.
 */

const REDDIT_BASE = 'https://www.reddit.com';
const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const OPENAI_BASE = 'https://api.openai.com/v1';
const BREVO_BASE = 'https://api.brevo.com/v3';
const MAX_POSTS = 100;
const PERIOD_HOURS = 48;
const USER_AGENT = 'web:TrendWatcher:v1.0 (by /u/sdglab)';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  subreddit: string;
  created_utc: number;
  permalink: string;
}

interface Signal {
  category: string;
  title: string;
  description: string;
  strength: string;
  sentiment: string;
  postCount: number;
  subreddits: string[];
  growthPercent?: number;
}

interface SpaceConfig {
  id: string;
  name: string;
  domain_prompt: string;
  subreddits: string[];
  email_recipients: string[];
}

// --- Reddit OAuth ---

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditOAuthToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Reddit OAuth failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  console.log('[reddit] OAuth token acquired');
  return cachedToken.token;
}

// --- Reddit Fetch ---

function parseRedditJson(json: Record<string, unknown>): RedditPost[] {
  const children = (json as { data?: { children?: { data: RedditPost }[] } })
    ?.data?.children ?? [];

  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;
  return children
    .filter((p) => p.data.created_utc > cutoff)
    .map((p) => p.data);
}

async function fetchWithOAuth(
  subreddit: string,
  token: string
): Promise<RedditPost[]> {
  const url = `${REDDIT_OAUTH_BASE}/r/${subreddit}/hot.json?limit=${MAX_POSTS}&raw_json=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`OAuth fetch r/${subreddit}: ${res.status}`);
  return parseRedditJson(await res.json());
}

async function fetchDirect(subreddit: string): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${subreddit}/hot.json?limit=${MAX_POSTS}&raw_json=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Direct fetch r/${subreddit}: ${res.status}`);
  return parseRedditJson(await res.json());
}

function parseRssPosts(xml: string, subreddit: string): RedditPost[] {
  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;
  const posts: RedditPost[] = [];

  const entries = xml.split('<entry>').slice(1);
  for (const entry of entries) {
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"') ?? '';
    const id = entry.match(/<id>.*?\/comments\/([\w]+)/)?.[1] ?? crypto.randomUUID();
    const link = entry.match(/<link href="([^"]+)"/)?.[1] ?? '';
    const updated = entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1];
    const content = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? '';

    const textContent = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    const createdUtc = updated ? new Date(updated).getTime() / 1000 : 0;
    if (createdUtc < cutoff) continue;

    posts.push({
      id,
      title,
      selftext: textContent,
      score: 0,
      num_comments: 0,
      subreddit,
      created_utc: createdUtc,
      permalink: link.replace('https://www.reddit.com', ''),
    });
  }

  return posts;
}

async function fetchViaRss(subreddit: string): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${subreddit}/hot.rss`;
  console.log(`[reddit] Trying RSS for r/${subreddit}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': `${USER_AGENT} RSS`, Accept: 'application/atom+xml,application/xml' },
  });
  if (!res.ok) throw new Error(`RSS fetch r/${subreddit}: ${res.status}`);

  const xml = await res.text();
  const posts = parseRssPosts(xml, subreddit);
  console.log(`[reddit] r/${subreddit}: RSS parsed ${posts.length} posts`);
  return posts;
}

async function fetchSubreddit(
  subreddit: string,
  oauthToken?: string
): Promise<RedditPost[]> {
  if (oauthToken) {
    console.log(`[reddit] r/${subreddit}: trying OAuth`);
    try {
      const posts = await fetchWithOAuth(subreddit, oauthToken);
      console.log(`[reddit] r/${subreddit}: OAuth OK, ${posts.length} posts`);
      return posts;
    } catch (err) {
      console.error(`[reddit] r/${subreddit}: OAuth failed:`, err);
    }
  }

  console.log(`[reddit] r/${subreddit}: trying direct`);
  try {
    const posts = await fetchDirect(subreddit);
    console.log(`[reddit] r/${subreddit}: direct OK, ${posts.length} posts`);
    return posts;
  } catch (err) {
    console.error(`[reddit] r/${subreddit}: direct failed:`, err);
  }

  console.log(`[reddit] r/${subreddit}: trying RSS fallback`);
  const posts = await fetchViaRss(subreddit);
  console.log(`[reddit] r/${subreddit}: RSS OK, ${posts.length} posts`);
  return posts;
}

interface FetchResult {
  posts: RedditPost[];
  errors: string[];
}

async function fetchAllSubreddits(
  subreddits: string[],
  oauthToken?: string
): Promise<FetchResult> {
  const results = await Promise.allSettled(
    subreddits.map((sub) => fetchSubreddit(sub, oauthToken))
  );
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push(`r/${subreddits[i]}: ${msg}`);
      console.error(`[reddit] r/${subreddits[i]} failed:`, r.reason);
    }
  }

  const posts = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return { posts, errors };
}

// --- OpenAI ---

const BASE_PROMPT = `Your job: analyze Reddit posts and extract ACTIONABLE signals that help founders decide what to build next.

Return JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary. State the most important finding first. Be specific — name the trend, not 'various topics were discussed'.",
  "signals": [
    {
      "category": "emerging_topic" | "growing_trend" | "pain_point" | "hypothesis",
      "title": "Short descriptive title (5-8 words)",
      "description": "What's happening AND why it matters for product decisions. Reference specific post patterns you observed. For hypotheses — describe a concrete product feature, not a vague idea.",
      "strength": "high" | "medium" | "low",
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "postCount": number of posts supporting this signal,
      "subreddits": ["which subreddits"],
      "growthPercent": estimated growth vs normal volume (null if unknown)
    }
  ]
}

Signal guidelines:
- EMERGING TOPICS: themes that are new or unusual for these communities. What would surprise a regular reader?
- GROWING TRENDS: topics getting more posts/engagement than typical. Estimate growth percentage based on post density and engagement.
- PAIN POINTS: specific frustrations users express repeatedly. Focus on unmet needs that a product could address. Each pain point must describe the user's actual words/sentiment, not just a label.
- HYPOTHESES: each must link to at least one pain point or trend above. Format: "Because users report [pain], a product that [solution] could [outcome]."

Quality rules:
- 3-5 signals per category, prioritized by strength
- Every signal must be grounded in specific posts — don't invent patterns
- Prefer concrete ("users ask for AI chat companions at 2-3am") over vague ("loneliness is discussed")
- Strength = high means 10+ posts with strong engagement, medium = 3-9 posts, low = emerging pattern in 1-2 posts`;

function buildSystemPrompt(domainPrompt: string): string {
  if (domainPrompt.trim()) {
    return `${domainPrompt.trim()}\n\n${BASE_PROMPT}`;
  }
  return `You are a general trend analyst.\n\n${BASE_PROMPT}`;
}

async function analyzeWithOpenAI(
  posts: RedditPost[],
  subreddits: string[],
  apiKey: string,
  domainPrompt: string
): Promise<{ summary: string; signals: Signal[] }> {
  const postsText = posts
    .slice(0, 200)
    .map(
      (p) =>
        `[r/${p.subreddit}] (score:${p.score}, comments:${p.num_comments}) ${p.title}\n${p.selftext?.slice(0, 200) || ''}`
    )
    .join('\n---\n');

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(domainPrompt) },
        {
          role: 'user',
          content: `Analyze ${posts.length} posts from ${subreddits.join(', ')} (last 48h):\n\n${postsText}`,
        },
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
  signals: Signal[],
  totalPosts: number,
  subreddits: string[],
  topPosts: RedditPost[],
  spaceName: string
): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const categoryEmoji: Record<string, string> = {
    emerging_topic: '🆕',
    growing_trend: '📈',
    pain_point: '😰',
    hypothesis: '💡',
  };

  const categoryLabel: Record<string, string> = {
    emerging_topic: 'NEW EMERGING TOPICS',
    growing_trend: 'GROWING TRENDS',
    pain_point: 'PAIN POINTS',
    hypothesis: 'PRODUCT HYPOTHESES',
  };

  const strengthColor: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  };

  const categories = ['emerging_topic', 'growing_trend', 'pain_point', 'hypothesis'];
  const sections = categories
    .map((cat) => {
      const catSignals = signals.filter((s) => s.category === cat);
      if (catSignals.length === 0) return '';

      const items = catSignals
        .map(
          (s) => `
        <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;color:#fafafa;">${s.title}</span>
            <span style="background:${strengthColor[s.strength] ?? '#71717a'}22;color:${strengthColor[s.strength] ?? '#71717a'};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${s.strength}</span>
          </div>
          <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0 0 8px;">${s.description}</p>
          <div style="font-size:12px;color:#71717a;">
            ${s.growthPercent ? `<span style="color:#22c55e;font-weight:600;">+${s.growthPercent}%</span> · ` : ''}${s.postCount > 0 ? `${s.postCount} posts · ` : ''}${s.sentiment} · ${s.subreddits.map((r) => `r/${r}`).join(', ')}
          </div>
        </div>`
        )
        .join('');

      return `
        <div style="margin-bottom:24px;">
          <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">${categoryEmoji[cat]} ${categoryLabel[cat]}</h2>
          ${items}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,system-ui,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#8b5cf6;font-size:24px;margin:0;">📊 TrendWatcher Report</h1>
    <p style="color:#a78bfa;font-size:14px;margin:4px 0 0;font-weight:600;">${spaceName}</p>
    <p style="color:#71717a;font-size:14px;margin:8px 0 0;">${date}</p>
  </div>
  <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 8px;">Executive Summary</h2>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">${summary}</p>
    <p style="color:#52525b;font-size:12px;margin:12px 0 0;">${totalPosts} posts from ${subreddits.map((s) => `r/${s}`).join(', ')}</p>
  </div>
  ${sections}
  ${topPosts.length > 0 ? `
  <div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">🔗 Top Discussed Posts</h2>
    ${topPosts.map((p) => `
    <div style="border-left:3px solid #8b5cf6;padding:8px 12px;margin-bottom:8px;">
      <a href="https://www.reddit.com${p.permalink}" style="color:#c4b5fd;font-size:13px;text-decoration:none;font-weight:500;">${p.title}</a>
      <div style="font-size:11px;color:#71717a;margin-top:4px;">r/${p.subreddit}${p.score > 0 ? ` · ${p.score} pts` : ''}${p.num_comments > 0 ? ` · ${p.num_comments} comments` : ''}</div>
    </div>`).join('')}
  </div>` : ''}
  <div style="text-align:center;padding-top:24px;border-top:1px solid #27272a;">
    <p style="color:#52525b;font-size:12px;margin:0;">TrendWatcher · ${spaceName}</p>
  </div>
</div></body></html>`;
}

async function sendEmail(
  html: string,
  recipients: string[],
  apiKey: string,
  senderEmail: string,
  spaceName: string
): Promise<void> {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'TrendWatcher', email: senderEmail },
      to: recipients.map((email) => ({ email })),
      subject: `📊 ${spaceName} — TrendWatcher Report — ${date}`,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
}

// --- Space processing ---

async function processSpace(
  space: SpaceConfig,
  openaiKey: string,
  brevoKey: string | undefined,
  senderEmail: string,
  supabaseUrl: string,
  supabaseKey: string,
  oauthToken: string | undefined
): Promise<{ spaceId: string; spaceName: string; postsAnalyzed: number; signalsFound: number; emailSent: boolean; error?: string }> {
  const subreddits = space.subreddits.map((s) => s.replace(/\/+$/, '').trim()).filter(Boolean);
  const recipients = space.email_recipients;

  console.log(`[space:${space.name}] Fetching posts from: ${subreddits.join(', ')}`);
  const { posts, errors: redditErrors } = await fetchAllSubreddits(subreddits, oauthToken);
  console.log(`[space:${space.name}] Fetched ${posts.length} posts, ${redditErrors.length} errors`);

  if (posts.length === 0) {
    console.warn(`[space:${space.name}] No posts fetched, skipping`);
    return { spaceId: space.id, spaceName: space.name, postsAnalyzed: 0, signalsFound: 0, emailSent: false, error: 'No posts fetched' };
  }

  console.log(`[space:${space.name}] Running AI analysis...`);
  const analysis = await analyzeWithOpenAI(posts, subreddits, openaiKey, space.domain_prompt);
  console.log(`[space:${space.name}] Found ${analysis.signals.length} signals`);

  const now = new Date().toISOString();
  const rawPostCount: Record<string, number> = {};
  for (const sub of subreddits) {
    rawPostCount[sub] = posts.filter((p) => p.subreddit === sub).length;
  }

  const report = {
    id: crypto.randomUUID(),
    created_at: now,
    date_from: new Date(Date.now() - PERIOD_HOURS * 3600000).toISOString(),
    date_to: now,
    subreddits,
    total_posts_analyzed: posts.length,
    summary: analysis.summary,
    signals: analysis.signals,
    raw_post_count: rawPostCount,
    space_id: space.id,
  };

  const dbRes = await fetch(`${supabaseUrl}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(report),
  });

  if (!dbRes.ok) {
    const dbErr = await dbRes.text();
    console.error(`[space:${space.name}] DB save error:`, dbErr);
  } else {
    console.log(`[space:${space.name}] Report saved to database`);
  }

  let emailSent = false;
  if (brevoKey && recipients.length > 0) {
    try {
      const topPosts = [...posts]
        .sort((a, b) => (b.score + b.num_comments) - (a.score + a.num_comments))
        .slice(0, 15);
      const html = buildEmailHtml(analysis.summary, analysis.signals, posts.length, subreddits, topPosts, space.name);
      await sendEmail(html, recipients, brevoKey, senderEmail, space.name);
      emailSent = true;
      console.log(`[space:${space.name}] Email sent to: ${recipients.join(', ')}`);
    } catch (emailErr) {
      console.error(`[space:${space.name}] Email failed (non-blocking):`, emailErr);
    }
  }

  return { spaceId: space.id, spaceName: space.name, postsAnalyzed: posts.length, signalsFound: analysis.signals.length, emailSent };
}

// --- Handler ---

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID');
    const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');

    let oauthToken: string | undefined;
    if (redditClientId && redditClientSecret) {
      try {
        oauthToken = await getRedditOAuthToken(redditClientId, redditClientSecret);
      } catch (err) {
        console.error('[reddit] OAuth failed, falling back to unauthenticated:', err);
      }
    }

    // Parse request body
    let requestSpaceId: string | undefined;
    let bodySubreddits: string[] | undefined;
    let bodyRecipients: string[] | undefined;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        requestSpaceId = body.space_id;
        if (body.subreddits?.length > 0) bodySubreddits = body.subreddits;
        if (Array.isArray(body.emailRecipients) && body.emailRecipients.length > 0) bodyRecipients = body.emailRecipients;
      } catch {
        // empty body — process all spaces
      }
    }

    // Build list of spaces to process
    const spacesToProcess: SpaceConfig[] = [];

    if (requestSpaceId) {
      // Manual call with specific space_id
      const spaceRes = await fetch(
        `${supabaseUrl}/rest/v1/spaces?id=eq.${requestSpaceId}&select=id,name,domain_prompt,subreddits,email_recipients`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (spaceRes.ok) {
        const rows = await spaceRes.json();
        if (rows.length > 0) {
          const space = rows[0] as SpaceConfig;
          if (bodySubreddits) space.subreddits = bodySubreddits;
          if (bodyRecipients) space.email_recipients = bodyRecipients;
          spacesToProcess.push(space);
        }
      }
    } else {
      // Cron or no space_id — process all active spaces
      const spacesRes = await fetch(
        `${supabaseUrl}/rest/v1/spaces?is_active=eq.true&select=id,name,domain_prompt,subreddits,email_recipients&order=created_at.asc`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (spacesRes.ok) {
        const rows = await spacesRes.json();
        spacesToProcess.push(...(rows as SpaceConfig[]));
      }
    }

    if (spacesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No spaces found to process' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[daily-report] Processing ${spacesToProcess.length} space(s): ${spacesToProcess.map((s) => s.name).join(', ')}`);

    const results = [];
    for (const space of spacesToProcess) {
      try {
        const result = await processSpace(space, openaiKey, brevoKey, senderEmail, supabaseUrl, supabaseKey, oauthToken);
        results.push(result);
      } catch (err) {
        console.error(`[space:${space.name}] Fatal error:`, err);
        results.push({
          spaceId: space.id,
          spaceName: space.name,
          postsAnalyzed: 0,
          signalsFound: 0,
          emailSent: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, spaces: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[daily-report] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

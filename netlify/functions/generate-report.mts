import type { Context } from '@netlify/functions';

const REDDIT_BASE = 'https://www.reddit.com';
const OPENAI_BASE = 'https://api.openai.com/v1';
const RESEND_BASE = 'https://api.resend.com';
const MAX_POSTS = 100;
const PERIOD_HOURS = 48;

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

// --- Reddit ---

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${subreddit}/hot.json?limit=${MAX_POSTS}&raw_json=1`;
  console.log(`[reddit] Fetching ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'web:TrendWatcher:v1.0 (by /u/sdglab)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[reddit] r/${subreddit} HTTP ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`Reddit HTTP ${res.status} for r/${subreddit}`);
  }

  const data = await res.json();
  const children = data?.data?.children ?? [];
  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;

  const posts = children
    .filter((p: { data: RedditPost }) => p.data.created_utc > cutoff)
    .map((p: { data: RedditPost }) => p.data);

  console.log(`[reddit] r/${subreddit}: ${children.length} raw → ${posts.length} after cutoff`);
  return posts;
}

async function fetchAllSubreddits(subreddits: string[]) {
  const results = await Promise.allSettled(subreddits.map(fetchSubreddit));
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push(`r/${subreddits[i]}: ${msg}`);
    }
  }

  const posts = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return { posts, errors };
}

// --- OpenAI ---

const SYSTEM_PROMPT = `You are a trend analyst for SDG Lab, analyzing Reddit discussions about loneliness, depression, and communication.
Return JSON: { "summary": "...", "signals": [{ "category": "emerging_topic"|"growing_trend"|"pain_point"|"hypothesis", "title": "...", "description": "...", "strength": "high"|"medium"|"low", "sentiment": "positive"|"negative"|"mixed"|"neutral", "postCount": N, "subreddits": [...], "growthPercent": N|null }] }
Focus on: loneliness, companionship, emotional support, peer communication, mental health tools. 3-5 signals per category.`;

async function analyzeWithOpenAI(
  posts: RedditPost[],
  subreddits: string[],
  apiKey: string
): Promise<{ summary: string; signals: Signal[] }> {
  const postSummaries = posts.slice(0, 80).map((p) => ({
    sub: p.subreddit,
    title: p.title,
    text: p.selftext?.slice(0, 300) || '',
    score: p.score,
    comments: p.num_comments,
  }));

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze ${posts.length} posts from ${subreddits.map((s) => `r/${s}`).join(', ')}:\n\n${JSON.stringify(postSummaries)}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content);
}

// --- Supabase ---

async function saveReport(
  report: Record<string, unknown>,
  supabaseUrl: string,
  supabaseKey: string
) {
  const res = await fetch(`${supabaseUrl}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(report),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[db] Save error:', err);
    throw new Error(`DB save failed: ${res.status}`);
  }
}

// --- Email ---

const strengthColor: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const categoryLabel: Record<string, string> = {
  emerging_topic: 'Emerging Topics',
  growing_trend: 'Growing Trends',
  pain_point: 'Pain Points',
  hypothesis: 'Product Hypotheses',
};

const categoryEmoji: Record<string, string> = {
  emerging_topic: '🆕',
  growing_trend: '📈',
  pain_point: '🔴',
  hypothesis: '💡',
};

function buildEmailHtml(
  summary: string,
  signals: Signal[],
  totalPosts: number,
  subreddits: string[]
) {
  const categories = ['emerging_topic', 'growing_trend', 'pain_point', 'hypothesis'];
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sections = categories
    .filter((cat) => signals.some((s) => s.category === cat))
    .map((cat) => {
      const catSignals = signals.filter((s) => s.category === cat);
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
    <p style="color:#71717a;font-size:14px;margin:8px 0 0;">${date}</p>
  </div>
  <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 8px;">Executive Summary</h2>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">${summary}</p>
    <p style="color:#52525b;font-size:12px;margin:12px 0 0;">${totalPosts} posts from ${subreddits.map((s) => `r/${s}`).join(', ')}</p>
  </div>
  ${sections}
  <div style="text-align:center;padding-top:24px;border-top:1px solid #27272a;">
    <p style="color:#52525b;font-size:12px;margin:0;">TrendWatcher by SDG Lab</p>
  </div>
</div></body></html>`;
}

async function sendEmail(html: string, recipients: string[], apiKey: string) {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const res = await fetch(`${RESEND_BASE}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TrendWatcher <onboarding@resend.dev>',
      to: recipients,
      subject: `📊 TrendWatcher Daily Report — ${date}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// --- Handler ---

export default async (req: Request, _context: Context) => {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const recipients = (process.env.EMAIL_RECIPIENTS ?? '').split(',').filter(Boolean);

    let subreddits = (process.env.SUBREDDITS ?? 'lonely,depression,socialskills')
      .split(',')
      .filter(Boolean);

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.subreddits?.length > 0) {
          subreddits = body.subreddits;
        }
      } catch {
        // no body — use defaults
      }
    }

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[report] Fetching from: ${subreddits.join(', ')}`);
    const { posts, errors: redditErrors } = await fetchAllSubreddits(subreddits);
    console.log(`[report] ${posts.length} posts, ${redditErrors.length} errors`);

    if (posts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No posts fetched from Reddit', redditErrors, subreddits }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[report] Running AI analysis...');
    const analysis = await analyzeWithOpenAI(posts, subreddits, openaiKey);
    console.log(`[report] ${analysis.signals.length} signals found`);

    const now = new Date().toISOString();
    const rawPostCount: Record<string, number> = {};
    for (const sub of subreddits) {
      rawPostCount[sub] = posts.filter((p) => p.subreddit === sub).length;
    }

    if (supabaseUrl && supabaseKey) {
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
      };

      await saveReport(report, supabaseUrl, supabaseKey);
      console.log('[report] Saved to database');
    }

    if (resendKey && recipients.length > 0) {
      const html = buildEmailHtml(analysis.summary, analysis.signals, posts.length, subreddits);
      await sendEmail(html, recipients, resendKey);
      console.log(`[report] Email sent to: ${recipients.join(', ')}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        postsAnalyzed: posts.length,
        signalsFound: analysis.signals.length,
        emailSent: !!(resendKey && recipients.length > 0),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[report] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

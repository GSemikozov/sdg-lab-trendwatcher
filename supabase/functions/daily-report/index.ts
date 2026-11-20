/**
 * Supabase Edge Function: daily-report
 *
 * Triggered by pg_cron (daily) or manual HTTP call.
 * Supports multi-space: each space has its own subreddits, recipients, and domain prompt.
 *
 * Auth (before any Redlisten / reddit-proxy spend):
 * - Cron / all-spaces: `x-cron-secret` or Bearer must match Edge `CRON_SECRET`
 *   (or Bearer = service role).
 * - Manual: valid project JWT (anon/authenticated) + existing active `space_id`.
 *
 * Manual call: POST with { space_id, emailRecipients? } — subreddits come from DB.
 * Cron call: POST with empty body → processes ALL active spaces sequentially.
 */

const REDDIT_BASE = 'https://www.reddit.com';
const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const REDLISTEN_BASE = 'https://api.redlisten.com';
const OPENAI_BASE = 'https://api.openai.com/v1';
const BREVO_BASE = 'https://api.brevo.com/v3';
const MAX_POSTS = 100;
const PERIOD_HOURS = 48;
const USER_AGENT = 'web:TrendWatcher:v1.0 (by /u/sdglab)';
const REDDIT_PROXY_URL = Deno.env.get('REDDIT_PROXY_URL');
const REDDIT_PROXY_SECRET = Deno.env.get('REDDIT_PROXY_SECRET');
const REDLISTEN_API_KEY = Deno.env.get('REDLISTEN_API_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');
/** Free plan: 1k req/mo — batch subs into one Atom call when possible. */
const REDLISTEN_BATCH_SIZE = 8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

class RedlistenQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedlistenQuotaError';
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function bearerFromAuthorization(header: string | null): string {
  if (!header) return '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? '';
}

function decodeJwtRole(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as { role?: string };
    return typeof parsed.role === 'string' ? parsed.role : undefined;
  } catch {
    return undefined;
  }
}

type RequestAuth =
  | { kind: 'cron' }
  | { kind: 'manual'; role: 'anon' | 'authenticated' };

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Authenticate before Redlisten / proxy. Cron is a separate secret; manual is JWT + space ACL.
 */
function authorizeDailyReportRequest(
  req: Request,
  serviceRoleKey: string
): RequestAuth | Response {
  const cronHeader = (req.headers.get('x-cron-secret') ?? '').trim();
  const bearer = bearerFromAuthorization(req.headers.get('Authorization'));

  if (CRON_SECRET) {
    if (cronHeader && timingSafeEqualString(cronHeader, CRON_SECRET)) {
      return { kind: 'cron' };
    }
    if (bearer && timingSafeEqualString(bearer, CRON_SECRET)) {
      return { kind: 'cron' };
    }
  }

  if (bearer && timingSafeEqualString(bearer, serviceRoleKey)) {
    return { kind: 'cron' };
  }

  if (!bearer) {
    return jsonError(
      401,
      'Unauthorized: send Authorization Bearer (manual) or x-cron-secret (cron) before report generation'
    );
  }

  const role = decodeJwtRole(bearer);
  if (role === 'service_role') return { kind: 'cron' };
  if (role === 'authenticated') return { kind: 'manual', role: 'authenticated' };
  if (role === 'anon') return { kind: 'manual', role: 'anon' };

  return jsonError(401, 'Unauthorized: invalid or unrecognized credentials');
}

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

interface AdConcept {
  title: string;
  description: string;
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

async function getRedditOAuthToken(clientId: string, clientSecret: string): Promise<string> {
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
  const children = (json as { data?: { children?: { data: RedditPost }[] } })?.data?.children ?? [];

  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;
  return children.filter((p) => p.data.created_utc > cutoff).map((p) => p.data);
}

async function fetchWithOAuth(subreddit: string, token: string): Promise<RedditPost[]> {
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

function parseRssPosts(xml: string, defaultSubreddit: string): RedditPost[] {
  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;
  const posts: RedditPost[] = [];

  const entries = xml.split('<entry>').slice(1);
  for (const entry of entries) {
    const title =
      entry
        .match(/<title>([\s\S]*?)<\/title>/)?.[1]
        ?.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"') ?? '';
    const id = entry.match(/<id>.*?\/comments\/([\w]+)/)?.[1] ?? crypto.randomUUID();
    const link = entry.match(/<link href="([^"]+)"/)?.[1] ?? '';
    const updated = entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1];
    const content = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? '';

    const textContent = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    const createdUtc = updated ? new Date(updated).getTime() / 1000 : 0;
    if (createdUtc < cutoff) continue;

    const fromLink = link.match(/\/r\/([^/]+)\//)?.[1];
    const subreddit = fromLink || defaultSubreddit.split('+')[0] || defaultSubreddit;

    posts.push({
      id,
      title,
      selftext: textContent,
      score: 0,
      num_comments: 0,
      subreddit,
      created_utc: createdUtc,
      permalink: link
        .replace(/^https?:\/\/(www\.)?reddit\.com/, '')
        .replace(/^https?:\/\/api\.redlisten\.com/, ''),
    });
  }

  return posts;
}

async function fetchViaRedlisten(subreddits: string[]): Promise<RedditPost[]> {
  if (!REDLISTEN_API_KEY) {
    throw new Error('REDLISTEN_API_KEY not set');
  }
  const joined = subreddits.map((s) => s.trim()).filter(Boolean).join('+');
  const url = `${REDLISTEN_BASE}/r/${joined}/new.rss?key=${encodeURIComponent(REDLISTEN_API_KEY)}`;
  console.log(`[reddit] Redlisten Free feed r/${joined}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': `${USER_AGENT} Redlisten`,
      Accept: 'application/atom+xml,application/xml',
      Authorization: `Bearer ${REDLISTEN_API_KEY}`,
    },
  });
  // Classify 429 from status alone — body read may fail after quota responses.
  const status = res.status;
  const text = await res.text().catch(() => '');
  if (status === 429) {
    throw new RedlistenQuotaError(
      `Redlisten Free quota exceeded (upstream rejects until next UTC month; no auto-charge to Pro). ${text.slice(0, 160)}`
    );
  }
  if (!res.ok) {
    throw new Error(`Redlisten r/${joined}: ${status} ${text.slice(0, 160)}`);
  }
  const posts = parseRssPosts(text, joined);
  console.log(`[reddit] Redlisten parsed ${posts.length} posts for r/${joined}`);
  return posts;
}

async function fetchViaRedditPublicRss(subreddit: string): Promise<RedditPost[]> {
  // Reddit shut down public RSS (Nov 2026). Ladder kept for completeness.
  const urls = [
    `${REDDIT_BASE}/r/${subreddit}/.rss`,
    `${REDDIT_BASE}/r/${subreddit}/hot/.rss`,
    `${REDDIT_BASE}/r/${subreddit}/hot.rss`,
  ];

  const errors: string[] = [];
  for (const url of urls) {
    console.log(`[reddit] Trying RSS for r/${subreddit}: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': `${USER_AGENT} RSS`,
          Accept: 'application/atom+xml,application/xml',
        },
      });
      if (!res.ok) {
        errors.push(`${url} → ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const posts = parseRssPosts(xml, subreddit);
      console.log(`[reddit] r/${subreddit}: RSS parsed ${posts.length} posts from ${url}`);
      if (posts.length > 0) return posts;
      errors.push(`${url} → empty feed`);
    } catch (err) {
      errors.push(`${url} → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `RSS fetch r/${subreddit} failed. Set REDLISTEN_API_KEY (Free, no card) or restore a feed source. ${errors.join('; ')}`
  );
}

async function fetchViaRss(subreddit: string, opts?: { skipRedlisten?: boolean }): Promise<RedditPost[]> {
  // Prefer Redlisten Free when configured — unless recovering after a failed batch
  // (skipRedlisten) so we do not burn more Free credits on the same failure mode.
  if (REDLISTEN_API_KEY && !opts?.skipRedlisten) {
    return fetchViaRedlisten([subreddit]);
  }
  return fetchViaRedditPublicRss(subreddit);
}

async function fetchSubreddit(
  subreddit: string,
  oauthToken?: string,
  opts?: { skipRedlisten?: boolean }
): Promise<RedditPost[]> {
  if (oauthToken) {
    console.log(`[reddit] r/${subreddit}: trying OAuth`);
    try {
      const posts = await fetchWithOAuth(subreddit, oauthToken);
      console.log(`[reddit] r/${subreddit}: OAuth OK, ${posts.length} posts`);
      if (posts.length > 0) return posts;
      console.warn(`[reddit] r/${subreddit}: OAuth returned 0 posts; falling through to direct/RSS`);
    } catch (err) {
      // Catch listing/network/parse failures and continue to direct → RSS.
      console.error(`[reddit] r/${subreddit}: OAuth listing failed, falling through:`, err);
    }
  }

  console.log(`[reddit] r/${subreddit}: trying direct`);
  try {
    const posts = await fetchDirect(subreddit);
    console.log(`[reddit] r/${subreddit}: direct OK, ${posts.length} posts`);
    if (posts.length > 0) return posts;
    console.warn(`[reddit] r/${subreddit}: direct returned 0 posts; trying RSS`);
  } catch (err) {
    console.error(`[reddit] r/${subreddit}: direct failed:`, err);
  }

  console.log(`[reddit] r/${subreddit}: trying RSS fallback`);
  const posts = await fetchViaRss(subreddit, opts);
  console.log(`[reddit] r/${subreddit}: RSS OK, ${posts.length} posts`);
  return posts;
}

interface FetchResult {
  posts: RedditPost[];
  errors: string[];
  source?: string;
  redlistenAttempted?: boolean;
}

// --- Embeddings ---

interface PostEmbeddingPayload {
  space_id: string;
  source: string;
  subreddit: string;
  post_id: string;
  posted_at: string;
  content: string;
  embedding: number[];
}

async function fetchAllSubredditsDirect(
  subreddits: string[],
  oauthToken?: string,
  opts?: { skipRedlisten?: boolean }
): Promise<FetchResult> {
  // Redlisten Free: batch into few Atom requests (1 credit each) instead of N.
  // skipRedlisten: proxy already spent Free credits — recover via OAuth/direct only.
  if (REDLISTEN_API_KEY && !opts?.skipRedlisten) {
    const errors: string[] = [];
    const posts: RedditPost[] = [];
    const recoverSubs: string[] = [];
    let redlistenQuotaExhausted = false;
    for (let i = 0; i < subreddits.length; i += REDLISTEN_BATCH_SIZE) {
      const batch = subreddits.slice(i, i + REDLISTEN_BATCH_SIZE);
      if (redlistenQuotaExhausted) {
        errors.push(
          `redlisten r/${batch.join('+')}: skipped after upstream 429; recovering via OAuth/direct`
        );
        recoverSubs.push(...batch);
        continue;
      }
      try {
        const batchPosts = await fetchViaRedlisten(batch);
        if (batchPosts.length === 0) {
          errors.push(`redlisten r/${batch.join('+')}: empty feed; recovering via OAuth/direct`);
          recoverSubs.push(...batch);
        } else {
          posts.push(...batchPosts);
          // Busy sub can fill the 50-item page; recover requested subs missing from the page.
          const present = new Set(
            batchPosts.map((p) => p.subreddit.toLowerCase()).filter(Boolean)
          );
          const missing = batch.filter((s) => !present.has(s.toLowerCase()));
          if (missing.length > 0) {
            errors.push(
              `redlisten r/${batch.join('+')}: page omitted ${missing.join('+')}; recovering via OAuth/direct (no Redlisten retry)`
            );
            recoverSubs.push(...missing);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof RedlistenQuotaError) {
          redlistenQuotaExhausted = true;
          errors.push(
            `redlisten r/${batch.join('+')}: ${msg}; stopping further Redlisten batches this run`
          );
        } else {
          errors.push(`redlisten r/${batch.join('+')}: ${msg}; recovering via OAuth/direct`);
        }
        console.error('[reddit] Redlisten batch failed:', err);
        recoverSubs.push(...batch);
      }
    }

    // Per-sub legacy recovery for failed/empty batches (skip Redlisten to avoid
    // spending more Free credits on the same failure). Needs OAuth/direct to help.
    if (recoverSubs.length > 0) {
      const recovery = await Promise.allSettled(
        recoverSubs.map((sub) => fetchSubreddit(sub, oauthToken, { skipRedlisten: true }))
      );
      for (let i = 0; i < recovery.length; i++) {
        const r = recovery[i];
        if (r.status === 'fulfilled') {
          posts.push(...r.value);
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          errors.push(`r/${recoverSubs[i]} recovery: ${msg}`);
          console.error(`[reddit] r/${recoverSubs[i]} recovery failed:`, r.reason);
        }
      }
    }

    return { posts, errors, source: 'redlisten', redlistenAttempted: true };
  }

  const results = await Promise.allSettled(
    subreddits.map((sub) => fetchSubreddit(sub, oauthToken, { skipRedlisten: opts?.skipRedlisten }))
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
  return {
    posts,
    errors,
    source: opts?.skipRedlisten ? 'legacy-after-redlisten' : 'legacy',
    redlistenAttempted: Boolean(opts?.skipRedlisten),
  };
}

async function fetchAllSubreddits(subreddits: string[], oauthToken?: string): Promise<FetchResult> {
  // Prefer proxy when configured (Netlify hosts Redlisten key in production).
  // Ambiguous proxy outcomes (transport/body loss, non-auth HTTP errors) must not
  // re-run Redlisten on Edge — the proxy may already have spent Free credits.
  let skipRedlistenOnFallback = false;

  if (REDDIT_PROXY_URL) {
    if (!REDDIT_PROXY_SECRET) {
      console.warn(
        '[reddit] REDDIT_PROXY_URL set but REDDIT_PROXY_SECRET missing; skipping proxy (auth required)'
      );
    } else {
      const url = `${REDDIT_PROXY_URL}?subreddits=${encodeURIComponent(subreddits.join(','))}`;
      console.log('[reddit] Using external proxy for subreddits:', subreddits.join(', '));
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
            Authorization: `Bearer ${REDDIT_PROXY_SECRET}`,
          },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error(`[reddit] proxy HTTP ${res.status}: ${text.slice(0, 200)}`);
          // Auth rejection happens before Redlisten; other statuses are ambiguous.
          if (res.status !== 401 && res.status !== 403) {
            skipRedlistenOnFallback = true;
          }
        } else {
          let data: {
            posts: RedditPost[];
            errors?: string[];
            source?: string;
            redlistenAttempted?: boolean;
          };
          try {
            data = (await res.json()) as typeof data;
          } catch (parseErr) {
            console.error('[reddit] proxy JSON undecodable; skipping Redlisten on fallback:', parseErr);
            skipRedlistenOnFallback = true;
            data = { posts: [] };
          }
          const errors = data.errors ?? [];
          if (errors.length > 0) {
            for (const e of errors) console.error('[reddit-proxy]', e);
          }
          const posts = data.posts ?? [];
          if (posts.length > 0) {
            return {
              posts,
              errors,
              source: data.source,
              redlistenAttempted: data.redlistenAttempted,
            };
          }
          // Empty or undecoded proxy: if Redlisten was (or may have been) attempted, do NOT re-spend.
          const redlistenAlready =
            skipRedlistenOnFallback ||
            data.redlistenAttempted === true ||
            (typeof data.source === 'string' && data.source.startsWith('redlisten'));
          if (redlistenAlready) {
            console.warn(
              '[reddit] proxy returned 0 posts after Redlisten/ambiguous body; recovering via OAuth/direct only (no Redlisten retry)'
            );
            return fetchAllSubredditsDirect(subreddits, oauthToken, { skipRedlisten: true });
          }
          console.warn('[reddit] proxy returned 0 posts; falling back to direct/Redlisten/OAuth');
        }
      } catch (err) {
        console.error('[reddit] proxy failed (ambiguous); skipping Redlisten on fallback:', err);
        skipRedlistenOnFallback = true;
      }
    }
  }

  const direct = await fetchAllSubredditsDirect(subreddits, oauthToken, {
    skipRedlisten: skipRedlistenOnFallback,
  });
  if (direct.posts.length === 0 && !oauthToken && !REDLISTEN_API_KEY) {
    direct.errors.push(
      'No Reddit posts fetched. Set REDLISTEN_API_KEY (Free at https://app.redlisten.com — no card, no auto Pro) on Edge + Netlify.'
    );
  }
  return direct;
}

async function upsertPostEmbeddings(
  spaceId: string,
  posts: RedditPost[],
  openaiKey: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  if (posts.length === 0) return;

  // Prepare inputs for embeddings: title + truncated selftext
  const inputs = posts.map((p) => {
    const body = p.selftext ? p.selftext.slice(0, 400) : '';
    return `[r/${p.subreddit}] ${p.title}\n\n${body}`;
  });

  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: inputs,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[embeddings] OpenAI error', res.status, errText.slice(0, 200));
    return; // Non-blocking: do not break daily reports
  }

  const data = await res.json();
  const embeddings: number[][] = data.data?.map((d: { embedding: number[] }) => d.embedding) ?? [];
  if (embeddings.length !== posts.length) {
    console.error(
      '[embeddings] Mismatch between posts and embeddings',
      posts.length,
      embeddings.length
    );
  }

  const payload: PostEmbeddingPayload[] = posts.map((p, idx) => ({
    space_id: spaceId,
    source: 'reddit',
    subreddit: p.subreddit,
    post_id: p.id,
    posted_at: new Date(p.created_utc * 1000).toISOString(),
    content: `${p.title}\n\n${p.selftext?.slice(0, 400) ?? ''}`,
    embedding: embeddings[idx] ?? [],
  }));

  try {
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/post_embeddings?on_conflict=space_id,post_id`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (!dbRes.ok) {
      const body = await dbRes.text().catch(() => '');
      console.error('[embeddings] Failed to upsert post_embeddings:', dbRes.status, body.slice(0, 200));
    } else {
      console.log(
        `[embeddings] Upserted ${payload.length} embeddings for space ${spaceId}`
      );
    }
  } catch (err) {
    console.error('[embeddings] Error while upserting embeddings:', err);
  }
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
  ],
  "ad_concepts": [
    {
      "title": "Short name of the creative concept",
      "description": "1-3 sentences describing the creative angle for a Meta ad (visual story + message + who it speaks to)."
    }
  ]
}

Signal guidelines:
- EMERGING TOPICS: themes that are new or unusual for these communities. What would surprise a regular reader?
- GROWING TRENDS: topics getting more posts/engagement than typical. Estimate growth percentage based on post density and engagement.
- PAIN POINTS: specific frustrations users express repeatedly. Focus on unmet needs that a product could address. Each pain point must describe the user's actual words/sentiment, not just a label.
- HYPOTHESES: each must link to at least one pain point or trend above. Format: "Because users report [pain], a product that [solution] could [outcome]."

Creative concepts guidelines:
- Use ONLY emerging topics, growing trends, and pain points as input (do not invent new themes).
- Each concept should describe: (1) the core emotional hook or story, (2) the problem it targets, (3) what kind of visual creative could express it (without writing copy or designing the layout).
- Think specifically about Meta ads (feed/reels/stories) — concepts should be implementable as static images or short videos.
- 3-5 concepts is enough. Prioritize the most actionable and differentiated ones.

Quality rules:
- 3-5 signals per category, prioritized by strength.
- Every signal and every ad concept must be grounded in specific posts — don't invent patterns.
- Prefer concrete ("late-night companion chat for people awake at 2-3am") over vague ("loneliness is discussed").
- Strength = high means 10+ posts with strong engagement, medium = 3-9 posts, low = emerging pattern in 1-2 posts.`;

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
): Promise<{ summary: string; signals: Signal[]; ad_concepts?: AdConcept[] }> {
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
  adConcepts: AdConcept[],
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

  const conceptsSection =
    adConcepts.length === 0
      ? ''
      : `
  <div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">🎯 Creative Concepts for Meta Ads</h2>
    <p style="color:#71717a;font-size:13px;margin:0 0 12px;">
      High-level directions for ad creatives, synthesized from emerging topics, growing trends, and pain points.
    </p>
    ${adConcepts
      .slice(0, 5)
      .map(
        (c) => `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="font-weight:600;color:#fafafa;margin-bottom:4px;">${c.title}</div>
      <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0;">${c.description}</p>
    </div>`
      )
      .join('')}
  </div>`;

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
  ${conceptsSection}
  ${sections}
  ${
    topPosts.length > 0
      ? `
  <div style="margin-bottom:24px;">
    <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">🔗 Top Discussed Posts</h2>
    ${topPosts
      .map(
        (p) => `
    <div style="border-left:3px solid #8b5cf6;padding:8px 12px;margin-bottom:8px;">
      <a href="https://www.reddit.com${p.permalink}" style="color:#c4b5fd;font-size:13px;text-decoration:none;font-weight:500;">${p.title}</a>
      <div style="font-size:11px;color:#71717a;margin-top:4px;">r/${p.subreddit}${p.score > 0 ? ` · ${p.score} pts` : ''}${p.num_comments > 0 ? ` · ${p.num_comments} comments` : ''}</div>
    </div>`
      )
      .join('')}
  </div>`
      : ''
  }
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
): Promise<{
  spaceId: string;
  spaceName: string;
  postsAnalyzed: number;
  signalsFound: number;
  emailSent: boolean;
  error?: string;
}> {
  const subreddits = space.subreddits.map((s) => s.replace(/\/+$/, '').trim()).filter(Boolean);
  const recipients = space.email_recipients;

  console.log(`[space:${space.name}] Fetching posts from: ${subreddits.join(', ')}`);
  const { posts, errors: redditErrors } = await fetchAllSubreddits(subreddits, oauthToken);
  console.log(`[space:${space.name}] Fetched ${posts.length} posts, ${redditErrors.length} errors`);

  if (posts.length === 0) {
    console.warn(`[space:${space.name}] No posts fetched, skipping`);
    return {
      spaceId: space.id,
      spaceName: space.name,
      postsAnalyzed: 0,
      signalsFound: 0,
      emailSent: false,
      error: 'No posts fetched',
    };
  }

  // Fire-and-forget embeddings storage; do not block or fail daily report
  upsertPostEmbeddings(space.id, posts, openaiKey, supabaseUrl, supabaseKey).catch((err) => {
    console.error(`[space:${space.name}] Embeddings failed (non-blocking):`, err);
  });

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
    ad_concepts: analysis.ad_concepts ?? [],
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
        .sort((a, b) => b.score + b.num_comments - (a.score + a.num_comments))
        .slice(0, 15);
      const html = buildEmailHtml(
        analysis.summary,
        analysis.signals,
        analysis.ad_concepts ?? [],
        posts.length,
        subreddits,
        topPosts,
        space.name
      );
      await sendEmail(html, recipients, brevoKey, senderEmail, space.name);
      emailSent = true;
      console.log(`[space:${space.name}] Email sent to: ${recipients.join(', ')}`);
    } catch (emailErr) {
      console.error(`[space:${space.name}] Email failed (non-blocking):`, emailErr);
    }
  }

  return {
    spaceId: space.id,
    spaceName: space.name,
    postsAnalyzed: posts.length,
    signalsFound: analysis.signals.length,
    emailSent,
  };
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

    if (!openaiKey) {
      return jsonError(500, 'OPENAI_API_KEY not set');
    }

    if (!supabaseUrl || !supabaseKey) {
      return jsonError(500, 'Supabase credentials not set');
    }

    // Gate Redlisten / proxy spend: auth before body side-effects and feed fetches.
    const auth = authorizeDailyReportRequest(req, supabaseKey);
    if (auth instanceof Response) return auth;

    // Parse request body
    let requestSpaceId: string | undefined;
    let bodyRecipients: string[] | undefined;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        requestSpaceId = body.space_id;
        if (Array.isArray(body.emailRecipients) && body.emailRecipients.length > 0)
          bodyRecipients = body.emailRecipients;
      } catch {
        // empty body — process all spaces (cron only)
      }
    }

    if (auth.kind === 'manual' && !requestSpaceId) {
      return jsonError(
        403,
        'Forbidden: manual callers must pass space_id; all-spaces runs require cron credentials'
      );
    }

    // Optional Reddit OAuth — only after auth (legacy recovery; not required without a Reddit account).
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID');
    const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');
    let oauthToken: string | undefined;
    if (redditClientId && redditClientSecret) {
      try {
        oauthToken = await getRedditOAuthToken(redditClientId, redditClientSecret);
      } catch (err) {
        console.error('[reddit] OAuth failed, falling back to Redlisten/RSS:', err);
      }
    }

    // Build list of spaces to process (subreddits always from DB — not caller-supplied).
    const spacesToProcess: SpaceConfig[] = [];

    if (requestSpaceId) {
      const spaceRes = await fetch(
        `${supabaseUrl}/rest/v1/spaces?id=eq.${encodeURIComponent(requestSpaceId)}&is_active=eq.true&select=id,name,domain_prompt,subreddits,email_recipients`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (spaceRes.ok) {
        const rows = await spaceRes.json();
        if (rows.length > 0) {
          const space = rows[0] as SpaceConfig;
          if (bodyRecipients) space.email_recipients = bodyRecipients;
          spacesToProcess.push(space);
        }
      }
      if (spacesToProcess.length === 0) {
        return jsonError(403, 'Forbidden: space not found, inactive, or not accessible');
      }
    } else {
      // Cron all-spaces path
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
      return jsonError(404, 'No spaces found to process');
    }

    console.log(
      `[daily-report] Processing ${spacesToProcess.length} space(s): ${spacesToProcess.map((s) => s.name).join(', ')}`
    );

    const results = [];
    for (const space of spacesToProcess) {
      try {
        const result = await processSpace(
          space,
          openaiKey,
          brevoKey,
          senderEmail,
          supabaseUrl,
          supabaseKey,
          oauthToken
        );
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

    const hasData = results.some((r) => r.postsAnalyzed > 0);
    const responseBody: Record<string, unknown> = { success: hasData, spaces: results };

    if (!hasData && results.length > 0) {
      responseBody.error = results[0].error ?? 'No posts fetched for this space';
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[daily-report] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

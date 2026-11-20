// Netlify Function: reddit-proxy
// Fetches Reddit listings and returns normalized posts.
//
// Auth: requires server-to-server credential before any feed fetch that can spend
// Redlisten Free credits. Callers (Edge daily-report) must send:
//   Authorization: Bearer <REDDIT_PROXY_SECRET>
// or header X-Reddit-Proxy-Secret: <REDDIT_PROXY_SECRET>
// Unauthenticated public calls get 401 and never touch REDLISTEN_API_KEY.

import { timingSafeEqual } from 'node:crypto';
//
// Primary path (no Reddit account): Redlisten Free RSS mirror
//   REDLISTEN_API_KEY → api.redlisten.com (Atom, same layout as old reddit.com RSS)
// Free plan: 1,000 req/month, 50 items/page. On upstream 429 we stop further Redlisten
// batches in this invocation (legacy OAuth/RSS recovery only). Redlisten itself rejects
// until the next UTC month — we do not claim a separate app-level pause across runs.
// No auto-upgrade / no auto-charge to Pro (upgrade is manual only).
//
// Optional Reddit OAuth (REDDIT_CLIENT_ID/SECRET on Netlify) — only if you have a Reddit
// app; not required when using Redlisten Free. Without OAuth, empty/failed batches fall
// back to public RSS (dead since Nov 2026) only.
// Last resort: www.reddit.com RSS (kept for ladder completeness).

const PERIOD_HOURS = 48;
const MAX_POSTS = 100;
const USER_AGENT = 'web:TrendWatcherNetlifyProxy:v1.0 (by /u/sdglab)';
const REDLISTEN_BASE = 'https://api.redlisten.com';
// Free plan page size is 50; keep multi-sub batches modest for URL length + mix.
const REDLISTEN_BATCH_SIZE = 8;

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function extractProxySecret(event) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const dedicated =
    headers['x-reddit-proxy-secret'] || headers['X-Reddit-Proxy-Secret'] || '';
  return typeof dedicated === 'string' ? dedicated.trim() : '';
}

function unauthorized(message) {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Parse Reddit/Redlisten RSS/Atom XML into normalized posts.
 * When defaultSubreddit is a multi (`a+b`), subreddit is taken from the entry link.
 */
function parseRssPosts(xml, defaultSubreddit) {
  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;
  const posts = [];

  const entries = xml.split('<entry>').slice(1);
  for (const entry of entries) {
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const title = (titleMatch ? titleMatch[1] : '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');

    const idMatch = entry.match(/<id>.*?\/comments\/([\w]+)/);
    const id = idMatch ? idMatch[1] : `${defaultSubreddit}-${Math.random().toString(36).slice(2)}`;

    const linkMatch = entry.match(/<link href="([^"]+)"/);
    const link = linkMatch ? linkMatch[1] : '';

    const updatedMatch = entry.match(/<updated>([\s\S]*?)<\/updated>/);
    const updated = updatedMatch ? updatedMatch[1] : null;

    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const content = contentMatch ? contentMatch[1] : '';

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
      permalink: link.replace(/^https?:\/\/(www\.)?reddit\.com/, '').replace(/^https?:\/\/api\.redlisten\.com/, ''),
    });
  }

  return posts;
}

function parseListingJson(json, subreddit) {
  const cutoff = Date.now() / 1000 - PERIOD_HOURS * 3600;
  const children = json?.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter((p) => p && p.created_utc > cutoff)
    .map((p) => ({
      id: p.id,
      title: p.title || '',
      selftext: (p.selftext || '').slice(0, 500),
      score: p.score || 0,
      num_comments: p.num_comments || 0,
      subreddit: p.subreddit || subreddit,
      created_utc: p.created_utc,
      permalink: p.permalink || '',
    }));
}

async function getOAuthToken(clientId, clientSecret) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
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
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth ${res.status} ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function fetchViaOAuth(subreddit, token) {
  const url = `https://oauth.reddit.com/r/${subreddit}/hot.json?limit=${MAX_POSTS}&raw_json=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`OAuth fetch ${res.status}`);
  return parseListingJson(await res.json(), subreddit);
}

/**
 * Redlisten Free Atom feed. One HTTP call = one monthly request credit.
 * Prefer batched multi-sub paths (`a+b+c`) to stay under Free 1k/month.
 */
async function fetchViaRedlisten(subreddits, apiKey) {
  const joined = subreddits.map((s) => s.trim()).filter(Boolean).join('+');
  // Redlisten docs: use new.rss (hot/top served newest-first; new is the stable path).
  const url = `${REDLISTEN_BASE}/r/${joined}/new.rss?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/atom+xml,application/xml',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const text = await res.text().catch(() => '');
  if (res.status === 429) {
    const err = new Error(
      `Redlisten Free quota exceeded (upstream rejects until next UTC month; no auto-charge). ${text.slice(0, 160)}`
    );
    err.code = 'REDLISTEN_QUOTA';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Redlisten ${res.status} ${text.slice(0, 160)}`);
  }
  return parseRssPosts(text, joined);
}

async function fetchViaRedditRss(subreddit) {
  const REDDIT_BASE = 'https://www.reddit.com';
  const urls = [
    `${REDDIT_BASE}/r/${subreddit}/.rss`,
    `${REDDIT_BASE}/r/${subreddit}/hot/.rss`,
    `${REDDIT_BASE}/r/${subreddit}/hot.rss`,
  ];
  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/atom+xml,application/xml',
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(`${url} → ${res.status} ${text.slice(0, 80)}`);
        continue;
      }
      const posts = parseRssPosts(await res.text(), subreddit);
      if (posts.length > 0) return { posts, errors };
      errors.push(`${url} → empty`);
    } catch (err) {
      errors.push(`${url} → ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { posts: [], errors };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const handler = async (event) => {
  try {
    const expectedSecret = process.env.REDDIT_PROXY_SECRET;
    if (!expectedSecret) {
      // Fail closed: without a shared secret we must not spend Redlisten quota
      // for arbitrary internet callers.
      return unauthorized(
        'REDDIT_PROXY_SECRET is not configured on Netlify; refusing unauthenticated feed fetch'
      );
    }
    const provided = extractProxySecret(event);
    if (!provided || !timingSafeEqualString(provided, expectedSecret)) {
      return unauthorized('Missing or invalid reddit-proxy credentials');
    }

    const subParam = event.queryStringParameters?.subreddits || '';
    const subreddits = subParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (subreddits.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'subreddits query param is required' }),
      };
    }

    const errors = [];
    const allPosts = [];
    const redlistenKey = process.env.REDLISTEN_API_KEY;
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    // Optional Reddit OAuth (legacy recovery / path without Redlisten)
    let oauthToken = null;
    if (clientId && clientSecret) {
      try {
        oauthToken = await getOAuthToken(clientId, clientSecret);
      } catch (err) {
        errors.push(`oauth: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    async function recoverSubViaLegacy(subreddit) {
      if (oauthToken) {
        try {
          const posts = await fetchViaOAuth(subreddit, oauthToken);
          if (posts.length > 0) return posts;
          errors.push(`r/${subreddit}: oauth returned 0 posts; trying RSS`);
        } catch (err) {
          errors.push(
            `r/${subreddit}: oauth listing failed (${err instanceof Error ? err.message : String(err)}); trying RSS`
          );
        }
      }
      const { posts, errors: rssErrors } = await fetchViaRedditRss(subreddit);
      errors.push(...rssErrors.map((e) => `r/${subreddit}: ${e}`));
      return posts;
    }

    // 1) Redlisten Free (preferred — no Reddit account)
    if (redlistenKey) {
      const recoverSubs = [];
      let redlistenQuotaExhausted = false;
      for (const batch of chunk(subreddits, REDLISTEN_BATCH_SIZE)) {
        if (redlistenQuotaExhausted) {
          errors.push(
            `redlisten r/${batch.join('+')}: skipped after upstream 429; recovering via OAuth/RSS`
          );
          recoverSubs.push(...batch);
          continue;
        }
        try {
          const posts = await fetchViaRedlisten(batch, redlistenKey);
          if (posts.length === 0) {
            errors.push(
              `redlisten r/${batch.join('+')}: empty feed; recovering via OAuth/RSS (no Redlisten retry)`
            );
            recoverSubs.push(...batch);
          } else {
            allPosts.push(...posts);
            // Busy sub can fill the 50-item page; recover requested subs missing from the page.
            const present = new Set(
              posts.map((p) => String(p.subreddit || '').toLowerCase()).filter(Boolean)
            );
            const missing = batch.filter((s) => !present.has(String(s).toLowerCase()));
            if (missing.length > 0) {
              errors.push(
                `redlisten r/${batch.join('+')}: page omitted ${missing.join('+')}; recovering via OAuth/RSS (no Redlisten retry)`
              );
              recoverSubs.push(...missing);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (err && err.code === 'REDLISTEN_QUOTA') {
            redlistenQuotaExhausted = true;
            errors.push(
              `redlisten r/${batch.join('+')}: ${msg}; stopping further Redlisten batches this run`
            );
          } else {
            errors.push(
              `redlisten r/${batch.join('+')}: ${msg}; recovering via OAuth/RSS (no Redlisten retry)`
            );
          }
          recoverSubs.push(...batch);
        }
      }

      // Per-sub legacy recovery for failed/empty batches — never re-hit Redlisten.
      for (const subreddit of recoverSubs) {
        try {
          allPosts.push(...(await recoverSubViaLegacy(subreddit)));
        } catch (err) {
          errors.push(
            `r/${subreddit} recovery: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        // source stays redlisten* so Edge must not re-spend Free credits on fallback.
        body: JSON.stringify({
          posts: allPosts,
          errors,
          source: recoverSubs.length > 0 ? 'redlisten+legacy' : 'redlisten',
          redlistenAttempted: true,
        }),
      };
    }

    errors.push(
      'REDLISTEN_API_KEY not set (Free key from https://app.redlisten.com — no card, no auto Pro)'
    );

    // 2) No Redlisten — full OAuth/RSS ladder per sub
    for (const subreddit of subreddits) {
      try {
        allPosts.push(...(await recoverSubViaLegacy(subreddit)));
      } catch (err) {
        errors.push(`r/${subreddit}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: allPosts,
        errors,
        source: oauthToken ? 'oauth+rss' : 'rss',
        redlistenAttempted: false,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
    };
  }
};

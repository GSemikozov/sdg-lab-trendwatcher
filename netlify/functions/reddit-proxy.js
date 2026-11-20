// Netlify Function: reddit-proxy
// Fetches Reddit listings from Netlify IPs and returns normalized posts.
// Prefers OAuth (REDDIT_CLIENT_ID/SECRET) because public RSS shut down Nov 2026
// and unauthenticated .json is blocked.

const PERIOD_HOURS = 48;
const MAX_POSTS = 100;
const USER_AGENT = 'web:TrendWatcherNetlifyProxy:v1.0 (by /u/sdglab)';

/**
 * Parse Reddit RSS/Atom XML into normalized posts.
 */
function parseRssPosts(xml, subreddit) {
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
    const id = idMatch ? idMatch[1] : `${subreddit}-${Math.random().toString(36).slice(2)}`;

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

async function fetchViaRss(subreddit) {
  const REDDIT_BASE = 'https://www.reddit.com';
  const urls = [
    `${REDDIT_BASE}/r/${subreddit}/.rss`,
    `${REDDIT_BASE}/r/${subreddit}/hot/.rss`,
    `${REDDIT_BASE}/r/${subreddit}/hot.rss`,
  ];
  const errors = [];
  for (const url of urls) {
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
  }
  return { posts: [], errors };
}

export const handler = async (event) => {
  try {
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
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    let oauthToken = null;

    if (clientId && clientSecret) {
      try {
        oauthToken = await getOAuthToken(clientId, clientSecret);
      } catch (err) {
        errors.push(`oauth: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      errors.push(
        'oauth: REDDIT_CLIENT_ID/SECRET not set on Netlify (required after Reddit RSS shutdown Nov 2026)'
      );
    }

    for (const subreddit of subreddits) {
      try {
        if (oauthToken) {
          try {
            const posts = await fetchViaOAuth(subreddit, oauthToken);
            if (posts.length > 0) {
              allPosts.push(...posts);
              continue;
            }
            errors.push(`r/${subreddit}: oauth returned 0 posts; trying RSS`);
          } catch (err) {
            errors.push(
              `r/${subreddit}: oauth listing failed (${err instanceof Error ? err.message : String(err)}); trying RSS`
            );
            // Fall through to RSS instead of skipping the subreddit entirely.
          }
        }
        const { posts, errors: rssErrors } = await fetchViaRss(subreddit);
        allPosts.push(...posts);
        errors.push(...rssErrors.map((e) => `r/${subreddit}: ${e}`));
      } catch (err) {
        errors.push(`r/${subreddit}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: allPosts, errors }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
    };
  }
};

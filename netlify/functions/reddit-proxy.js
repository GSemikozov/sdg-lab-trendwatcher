// Netlify Function: reddit-proxy
// Lightweight proxy that fetches public Reddit RSS feeds from Netlify's IPs
// and returns normalized posts for a list of subreddits.

/**
 * Parse Reddit RSS XML into a list of normalized posts.
 * Mirrors the shape expected by the Supabase Edge Function.
 */
function parseRssPosts(xml, subreddit) {
  const PERIOD_HOURS = 48;
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

exports.handler = async (event) => {
  try {
    const REDDIT_BASE = 'https://www.reddit.com';
    const subParam = event.queryStringParameters.subreddits || '';
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

    for (const subreddit of subreddits) {
      const url = `${REDDIT_BASE}/r/${subreddit}/hot.rss`;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'web:TrendWatcherNetlifyProxy:v1.0 (by /u/sdglab)',
            Accept: 'application/atom+xml,application/xml',
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          errors.push(`r/${subreddit}: RSS ${res.status} ${text.slice(0, 120)}`);
          continue;
        }

        const xml = await res.text();
        const posts = parseRssPosts(xml, subreddit);
        allPosts.push(...posts);
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


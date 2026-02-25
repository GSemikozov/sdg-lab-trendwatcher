import { API_CONFIG, APP_CONFIG } from '@shared/config';
import type { RedditPost } from '@shared/lib/types';

interface RedditApiPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    subreddit: string;
    created_utc: number;
    permalink: string;
  };
}

export interface RedditService {
  fetchSubredditPosts(subreddit: string): Promise<RedditPost[]>;
  fetchMultipleSubreddits(subreddits: string[]): Promise<RedditPost[]>;
}

export class RedditJsonService implements RedditService {
  async fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
    const url = `${API_CONFIG.REDDIT_BASE_URL}/r/${subreddit}/hot.json?limit=${APP_CONFIG.MAX_POSTS_PER_SUBREDDIT}&raw_json=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'TrendWatcher/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error for r/${subreddit}: ${response.status}`);
    }

    const data = await response.json();
    const cutoff = Date.now() / 1000 - APP_CONFIG.ANALYSIS_PERIOD_HOURS * 3600;

    return data.data.children
      .filter((post: RedditApiPost) => post.data.created_utc > cutoff)
      .map((post: RedditApiPost) => ({
        id: post.data.id,
        title: post.data.title,
        selftext: post.data.selftext,
        score: post.data.score,
        numComments: post.data.num_comments,
        subreddit: post.data.subreddit,
        createdUtc: post.data.created_utc,
        permalink: post.data.permalink,
        topComments: [],
      }));
  }

  async fetchMultipleSubreddits(subreddits: string[]): Promise<RedditPost[]> {
    const results = await Promise.allSettled(
      subreddits.map((sub) => this.fetchSubredditPosts(sub))
    );

    return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }
}

export function createRedditService(): RedditService {
  return new RedditJsonService();
}

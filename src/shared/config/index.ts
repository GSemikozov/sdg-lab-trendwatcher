export const APP_CONFIG = {
  APP_NAME: 'TrendWatcher',
  APP_DESCRIPTION: 'Reddit trend analysis for SDG Lab',
  DEFAULT_SUBREDDITS: ['lonely', 'depression', 'socialskills'],
  MAX_POSTS_PER_SUBREDDIT: 100,
  ANALYSIS_PERIOD_HOURS: 48,
  OPENAI_MODEL: 'gpt-4o-mini',
} as const;

export const API_CONFIG = {
  REDDIT_BASE_URL: 'https://www.reddit.com',
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  REQUEST_TIMEOUT: 30000,
} as const;

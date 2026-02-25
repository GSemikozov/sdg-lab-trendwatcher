export type SignalStrength = 'high' | 'medium' | 'low';

export type SentimentType = 'positive' | 'negative' | 'mixed' | 'neutral';

export type SignalCategory = 'emerging_topic' | 'growing_trend' | 'pain_point' | 'hypothesis';

export interface Signal {
  id: string;
  category: SignalCategory;
  title: string;
  description: string;
  strength: SignalStrength;
  sentiment: SentimentType;
  postCount: number;
  subreddits: string[];
  growthPercent?: number;
  relatedPosts?: RedditPostSummary[];
}

export interface RedditPostSummary {
  title: string;
  score: number;
  numComments: number;
  subreddit: string;
  createdUtc: number;
  permalink: string;
}

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  subreddit: string;
  createdUtc: number;
  permalink: string;
  topComments: RedditComment[];
}

export interface RedditComment {
  body: string;
  score: number;
  author: string;
}

export interface Report {
  id: string;
  createdAt: string;
  dateRange: {
    from: string;
    to: string;
  };
  subreddits: string[];
  totalPostsAnalyzed: number;
  signals: Signal[];
  summary: string;
  rawPostCount: Record<string, number>;
}

export interface SubredditConfig {
  name: string;
  enabled: boolean;
  category: string;
}

export interface AppSettings {
  subreddits: SubredditConfig[];
  emailRecipients: string[];
  aiProvider: 'openai' | 'mock';
  openaiModel: string;
}

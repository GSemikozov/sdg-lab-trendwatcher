import { API_CONFIG, APP_CONFIG } from '@shared/config';
import type { RedditPost, Report, Signal } from '@shared/lib/types';

export interface AIAnalysisService {
  analyzeRedditPosts(posts: RedditPost[], subreddits: string[]): Promise<Report>;
}

const ANALYSIS_SYSTEM_PROMPT = `You are a trend analyst for SDG Lab, a studio building products in p2p communication, emotional support, and companionship. You analyze Reddit discussions to find signals relevant to loneliness, depression, and communication domains.

Analyze the provided Reddit posts and return a JSON object with the following structure:
{
  "summary": "2-3 sentence executive summary of key findings",
  "signals": [
    {
      "category": "emerging_topic" | "growing_trend" | "pain_point" | "hypothesis",
      "title": "Short descriptive title",
      "description": "Detailed description with context",
      "strength": "high" | "medium" | "low",
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "postCount": number,
      "subreddits": ["subreddit names"],
      "growthPercent": number or null
    }
  ]
}

For each signal category:
- emerging_topic: New themes not commonly discussed before
- growing_trend: Topics showing acceleration in engagement
- pain_point: Specific user frustrations mapped to product domains
- hypothesis: Actionable product ideas derived from the signals

Focus on signals relevant to: loneliness, companionship, emotional support, peer-to-peer communication, mental health tools.
Aim for 3-5 signals per category. Be specific and actionable.`;

export class OpenAIAnalysisService implements AIAnalysisService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = APP_CONFIG.OPENAI_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyzeRedditPosts(posts: RedditPost[], subreddits: string[]): Promise<Report> {
    const postsText = posts
      .map(
        (p) =>
          `[r/${p.subreddit}] (score:${p.score}, comments:${p.numComments}) ${p.title}\n${p.selftext?.slice(0, 300) || ''}\nTop comments: ${p.topComments?.map((c) => c.body.slice(0, 150)).join(' | ') || 'none'}`
      )
      .join('\n---\n');

    const response = await fetch(`${API_CONFIG.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze these ${posts.length} posts from ${subreddits.join(', ')} (last 48 hours):\n\n${postsText}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const analysis = JSON.parse(content);
    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      createdAt: now,
      dateRange: {
        from: new Date(Date.now() - APP_CONFIG.ANALYSIS_PERIOD_HOURS * 3600000).toISOString(),
        to: now,
      },
      subreddits,
      totalPostsAnalyzed: posts.length,
      summary: analysis.summary,
      signals: analysis.signals.map((s: Omit<Signal, 'id'>) => ({
        ...s,
        id: crypto.randomUUID(),
      })),
      rawPostCount: subreddits.reduce(
        (acc, sub) => {
          acc[sub] = posts.filter((p) => p.subreddit === sub).length;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }
}

export function createAIService(apiKey: string): AIAnalysisService {
  return new OpenAIAnalysisService(apiKey);
}

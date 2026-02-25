# TrendWatcher — SDG Lab MVP

Internal signal intelligence tool that analyzes Reddit discussions daily to identify emerging topics, growing trends, user pain points, and actionable product hypotheses for SDG Lab.

## Architecture

```
┌──────────────────────────────────────────┐
│            Frontend (SPA)                 │
│   React 19 + TS + Vite + Tailwind        │
│   Feature Sliced Design (FSD)            │
│   useAutoReport hook (client-side cron)  │
└──────────────┬───────────────────────────┘
               │
    ┌──────────┴──────────────┐
    │       Supabase           │
    │  Edge Function           │ ← daily-report cron job
    │  (fetch → analyze → email)│
    │  PostgreSQL              │ ← Report storage (Phase 2)
    │  pg_cron                 │ ← Schedule trigger
    └──────────┬──────────────┘
        ┌──────┴──────┐──────────┐
        │ Reddit API  │ OpenAI   │ Resend (email)
        └─────────────┘──────────┘
```

### FSD Structure

```
src/
├── app/              # App shell: providers, routing, global styles
├── pages/            # Route-level components (Dashboard, Settings)
├── widgets/          # Composite UI blocks (TrendBoard, SignalList, ReportCard)
├── features/         # User actions (GenerateReport, ConfigureSubreddits, FilterSignals)
├── entities/         # Domain objects (Report, Signal, Subreddit)
├── shared/           # Infrastructure: UI kit, API clients, types, utils
│   ├── api/          # AI service, Reddit service, report storage
│   ├── ui/           # Reusable components (Button, Card, Badge, Skeleton)
│   ├── lib/          # Types, Zustand store, utilities
│   └── config/       # App & API configuration
└── test/             # Test setup
```

### Data Flow

1. **Fetch** — Reddit service fetches hot/new posts from configured subreddits (last 48h)
2. **Analyze** — AI service processes posts through OpenAI (gpt-4o-mini) with a structured analysis prompt
3. **Structure** — Response is parsed into typed signals: emerging topics, growing trends, pain points, product hypotheses
4. **Display** — Dashboard renders the report with filterable signal cards
5. **Persist** — Reports stored in IndexedDB (MVP) with abstraction layer for future Supabase migration
6. **Email** — Report sent to configured recipients via Resend

### Daily Cron Job

The system supports two scheduling modes:

**Client-side (MVP):** `useAutoReport` hook runs in the browser while the dashboard is open. Checks every 60 seconds if the configured hour has passed and no report exists for today. If triggered, it generates a report and sends email automatically.

**Server-side (Production):** Supabase Edge Function `daily-report` at `supabase/functions/daily-report/index.ts`. Triggered by pg_cron — no browser needed. Full pipeline: Reddit fetch → OpenAI analysis → DB storage → Resend email.

```sql
-- pg_cron setup (Supabase SQL Editor)
select cron.schedule(
  'daily-trendwatcher-report',
  '0 9 * * *',  -- every day at 09:00 UTC
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### AI Analysis Approach

**LLM-based analysis** (not embeddings/clustering) was chosen for MVP because:

- **Understands nuance** — sarcasm, tone, subtext that embeddings miss
- **Generates hypotheses** — can reason about *why* and *what to build*, not just find patterns
- **Handles daily volume well** — 2-3 subreddits produce hundreds of posts/day, fitting within context windows
- **Structured JSON output** — parseable, directly renderable results
- **Faster to ship** — no vector DB, no embedding pipeline, no cluster tuning

### Scaling Beyond MVP: Embeddings & Clustering

For longer-term, quantitative analysis the system can be extended with:

**Embeddings** (vector representations of post meaning):
- Cross-day topic tracking: compare today's posts against yesterday's semantically, not by keywords
- Duplicate detection: group "lonely in new city" / "moved, no friends" / "isolated after relocation" as one theme
- Anomaly detection: mathematically measure when a topic cluster grows 10x in 24h

**Clustering** (HDBSCAN / k-means on embeddings):
- Long-term trend visualization: 30-day topic evolution charts
- New topic discovery: posts that don't fit existing clusters = emerging signals
- Topic landscape maps: 2D scatter plots (via UMAP) showing what communities discuss

**Why not for MVP:** LLM gives 80% of value with 20% of effort. Embeddings + clustering add quantitative precision and historical comparison but require vector DB infrastructure (Pinecone / pgvector), embedding pipeline, and cluster tuning — justified after product-market fit.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Architecture | Feature Sliced Design with path aliases |
| Styling | Tailwind CSS v4 |
| State | Zustand (persisted settings) |
| Data fetching | React Query |
| Forms | React Hook Form + Zod |
| AI | OpenAI gpt-4o-mini (mock mode by default) |
| Storage | IndexedDB via `idb` (MVP) → Supabase PostgreSQL (prod) |
| Backend | Supabase Edge Functions (planned) |
| Email | Resend (planned) |
| Linting | Biome |
| Testing | Vitest |
| Icons | Lucide React |

## Quick Start

```bash
# Prerequisites
node >= 22 (use nvm)
nvm use

# Install
npm install

# Start dev server
npm run dev        # → http://localhost:3000

# Build
npm run build

# Test
npm run test       # watch mode
npm run test:run   # single run

# Lint
npm run lint
npm run lint:fix
```

## Configuration

Copy `.env.example` to `.env`:

```bash
# AI Provider: "mock" (default) or "openai"
VITE_AI_SERVICE_TYPE=mock

# Required when VITE_AI_SERVICE_TYPE=openai
VITE_OPENAI_API_KEY=sk-...

# For email delivery (planned)
VITE_RESEND_API_KEY=
```

**Mock mode** works out of the box — generates realistic sample reports with pre-built signals. Switch to `openai` with a valid API key for real Reddit analysis.

## Report Format

Each report contains structured signals across 4 categories:

| Category | What it captures |
|---|---|
| 🆕 **Emerging Topics** | New themes appearing for the first time |
| 📈 **Growing Trends** | Topics accelerating vs. baseline (with % growth) |
| 😰 **Pain Points** | User frustrations mapped to product domains |
| 💡 **Product Hypotheses** | Actionable ideas derived from signals |

Each signal includes: strength (high/medium/low), sentiment, post count, source subreddits, and growth percentage where applicable.

## Key Design Decisions

**Provider-agnostic AI**: `AIAnalysisService` interface abstracts OpenAI — swap to Anthropic, local LLM, or any provider by implementing one interface.

**Storage abstraction**: `ReportStorage` interface decouples persistence — IndexedDB for MVP, Supabase for production, with zero changes to business logic.

**Storybook-ready UI**: All shared/ui components are self-contained with typed props — ready for extraction into a design system package.

**No backend dependency for MVP**: Mock services enable full development and demo without Reddit API access or OpenAI keys.

## Answers to Mandatory Questions

### Which signals are most valuable for SDG Lab?

1. **Unmet needs with emotional urgency** — when users express pain with strong emotion around companionship, emotional support, or communication. Direct product opportunity signals.
2. **Behavioral shifts in coping mechanisms** — when users collectively adopt new patterns (AI chatbots for loneliness, Discord support groups). Shows organic market movement.
3. **Negative sentiment toward existing solutions** — frustration with therapy apps, dating apps, social media. Reveals gaps for differentiated positioning.

### How to make this a competitive advantage?

- **Speed**: Daily signals vs. quarterly reports. Launch MVPs in weeks while competitors are in research.
- **Domain tuning**: Prompts, subreddit selection, signal taxonomy tuned to SDG Lab's verticals.
- **Historical memory**: Longitudinal dataset of pain point evolution becomes a moat over time.
- **Hypothesis-to-backlog pipeline**: Every output is actionable, not just informational.

### How to automate trend-to-MVP pipeline?

1. **Phase 1** (now): Structured reports → human prioritization
2. **Phase 2**: Scoring system `opportunity = strength × domain_fit × competition_gap × urgency` → auto-ranked hypotheses in Slack
3. **Phase 3**: AI-generated product specs (personas, user stories, MVP scope) from approved hypotheses
4. **Phase 4**: Full loop: detect signal → score → generate spec → create repo from template → assign team. Human approval at gates only.

## License

Internal tool — SDG Lab proprietary.

# TrendWatcher — SDG Lab MVP

Internal signal intelligence tool that analyzes Reddit discussions daily, identifies emerging topics, growing trends, intensifying pain points, and actionable product hypotheses for SDG Lab's founders and marketing team.

**Live:** [sdg-lab-trendwatcher.netlify.app](https://sdg-lab-trendwatcher.netlify.app)

## How It Works

Every day at 09:00 UTC, a Supabase pg_cron job triggers an Edge Function that:

1. **Fetches** hot posts from configured subreddits (r/lonely, r/depression, r/socialskills) via a 3-tier strategy: Reddit OAuth → direct JSON API → RSS feed fallback
2. **Analyzes** posts through OpenAI gpt-4o-mini with a structured prompt tuned for actionable signal extraction
3. **Structures** output into 4 signal categories: emerging topics, growing trends, pain points, product hypotheses
4. **Saves** the report to Supabase PostgreSQL
5. **Emails** a formatted report with top discussed post links to configured recipients via Brevo
6. **Displays** the report on a web dashboard with comparison against previous reports

Reports can also be generated on demand via the dashboard's "Generate Report" button.

## Architecture

```
┌──────────────────────────────────────────┐
│            Frontend (SPA)                 │
│   React 19 + TS + Vite + Tailwind v4    │
│   Feature Sliced Design (FSD)            │
│   Zustand (persisted settings)           │
└──────────────┬───────────────────────────┘
               │ supabase.functions.invoke()
    ┌──────────┴──────────────┐
    │       Supabase           │
    │  Edge Function (Deno)    │ ← pg_cron daily at 09:00 UTC
    │  PostgreSQL              │ ← Report storage
    │  pg_cron + pg_net        │ ← Schedule trigger
    └──────────┬──────────────┘
        ┌──────┴──────┐───────────┐
        │ Reddit RSS  │ OpenAI    │ Brevo (email)
        └─────────────┘───────────┘
```

### Data Pipeline (Edge Function)

```
Reddit RSS/API  →  Parse posts  →  OpenAI gpt-4o-mini  →  Structured JSON
                                        │
                                        ▼
                              ┌─────────────────┐
                              │  4 signal types: │
                              │  🆕 Emerging     │
                              │  📈 Growing      │
                              │  😰 Pain points  │
                              │  💡 Hypotheses   │
                              └────────┬────────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                     Supabase DB   Email (Brevo)  Dashboard
```

### FSD Structure

```
src/
├── app/              # App shell: providers, routing, global styles
├── pages/            # Route-level components (Dashboard, Settings)
├── widgets/          # Composite UI blocks (TrendBoard, SignalList, ReportCard, ReportDiff)
├── features/         # User actions (GenerateReport, ConfigureSubreddits, ConfigureEmail, FilterSignals)
├── entities/         # Domain objects (Report, Signal, Subreddit)
├── shared/           # Infrastructure: UI kit, API clients, types, utils
│   ├── api/          # Supabase client, report storage, AI & Reddit service interfaces
│   ├── ui/           # Reusable components (Button, Card, Badge, Skeleton)
│   ├── lib/          # Types, Zustand store, report-diff, utilities
│   └── config/       # App & API configuration
└── test/             # Test setup
```

### Reddit Data Access

Reddit blocks API requests from cloud provider IPs. The Edge Function uses a 3-tier fallback:

1. **Reddit OAuth** (when credentials available) — official API with full access to posts/comments
2. **Direct JSON API** — works locally, blocked from most cloud IPs
3. **RSS feed** — `reddit.com/r/{sub}/hot.rss` — reliable from cloud IPs, limited metadata but sufficient for MVP analysis

When Reddit OAuth credentials are obtained (requires approved Reddit app), the system automatically upgrades to full API access with richer data.

### AI Analysis

**LLM-based analysis** (gpt-4o-mini) was chosen over embeddings/clustering for MVP because:

- **Understands nuance** — sarcasm, tone, emotional subtext that embeddings miss
- **Generates hypotheses** — reasons about *why* and *what to build*, not just finds patterns
- **Structured output** — returns typed JSON with categories, strength, sentiment, growth estimates
- **Handles daily volume** — 2-3 subreddits produce ~70-100 posts, well within context window
- **Faster to ship** — no vector DB, no embedding pipeline, no cluster tuning

The prompt instructs the model to:
- Ground every signal in specific post patterns (not vague summaries)
- Link hypotheses to observed pain points ("Because users report X, a product that Y could Z")
- Calibrate strength by post count: high (10+), medium (3-9), low (1-2)
- Estimate growth percentage based on post density and engagement

### Report Comparison

When 2+ reports exist, the dashboard automatically compares the selected report with the previous one and shows:
- New signals that weren't present before
- Signals that intensified (strength increased)
- Signals that weakened
- Signals that are no longer detected
- Post volume delta (absolute + percentage)

### Scaling Beyond MVP: Embeddings & Clustering

For longer-term quantitative analysis the system can be extended with:

**Embeddings** (vector representations of post meaning):
- Cross-day topic tracking: compare today's posts against yesterday's semantically, not by keywords
- Duplicate detection: group "lonely in new city" / "moved, no friends" / "isolated after relocation" as one theme
- Anomaly detection: mathematically measure when a topic cluster grows 10x in 24h

**Clustering** (HDBSCAN / k-means on embeddings):
- Long-term trend visualization: 30-day topic evolution charts
- New topic discovery: posts that don't fit existing clusters = emerging signals
- Topic landscape maps: 2D scatter plots (via UMAP) showing what communities discuss

**Why not for MVP:** LLM gives 80% of value with 20% of effort. Embeddings + clustering add quantitative precision and historical comparison but require vector DB infrastructure (pgvector), embedding pipeline, and cluster tuning — justified after product-market fit.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Architecture | Feature Sliced Design with path aliases |
| Styling | Tailwind CSS v4 |
| UI Kit | Custom components (Button, Card, Badge, Skeleton) — Storybook-ready |
| State | Zustand (persisted settings: subreddits, email recipients) |
| Data fetching | React Query |
| Forms | React Hook Form + Zod |
| AI | OpenAI gpt-4o-mini (server-side via Edge Function) |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL |
| Scheduling | pg_cron + pg_net (daily trigger at 09:00 UTC) |
| Email | Brevo (300 emails/day free tier) |
| Hosting | Netlify (static frontend only) |
| Linting | Biome |
| Testing | Vitest + Testing Library + jsdom |
| Icons | Lucide React |

## Quick Start

```bash
# Prerequisites: Node >= 22
nvm use 22

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start frontend dev server
npm run dev        # → http://localhost:3000

# (Optional) Run Edge Functions locally
cp supabase/.env.example supabase/.env
# Fill in API keys
npm run dev:functions

# To route frontend → local functions, uncomment in .env.local:
# VITE_FUNCTIONS_URL=http://localhost:54321/functions/v1
# (only works in dev mode — ignored in production builds automatically)
```

### Build & Deploy

```bash
npm run build      # Production build → dist/
npm run preview    # Preview production build

npm run test       # Watch mode
npm run test:run   # Single run
npm run lint       # Biome check
npm run lint:fix   # Biome auto-fix
```

Frontend deploys automatically to Netlify on push to `main`. Edge Function deploys via:

```bash
npx supabase functions deploy daily-report --no-verify-jwt
```

## Configuration

### Frontend (.env)

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

### Edge Function (supabase/.env or Supabase Dashboard → Edge Function Secrets)

```bash
OPENAI_API_KEY=sk-...           # Required
BREVO_API_KEY=xkeysib-...       # Required for email delivery
EMAIL_SENDER=you@gmail.com      # From address for reports
EMAIL_RECIPIENTS=team@co.com    # Default recipients (overridden by UI settings)
SUBREDDITS=lonely,depression,socialskills  # Default subreddits

# Supabase (auto-provided in production)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Reddit OAuth (optional — enables full API access)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
```

### pg_cron Setup (Supabase SQL Editor)

```sql
create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.schedule(
  'daily-trendwatcher-report',
  '0 9 * * *',  -- every day at 09:00 UTC
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/daily-report',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Report Format

Each report contains an executive summary and structured signals across 4 categories:

| Category | What it captures |
|---|---|
| 🆕 **Emerging Topics** | New themes appearing for the first time or gaining initial traction |
| 📈 **Growing Trends** | Topics accelerating vs. baseline (with estimated % growth) |
| 😰 **Pain Points** | Specific user frustrations with unmet needs a product could address |
| 💡 **Product Hypotheses** | Actionable ideas linked to observed pain points: "Because [pain], build [solution]" |

Each signal includes: title, description grounded in post evidence, strength (high/medium/low), sentiment, post count, source subreddits, and growth percentage.

Email reports additionally include links to the top 15 most discussed posts for quick verification.

## Key Design Decisions

**Supabase as unified backend.** Edge Functions, PostgreSQL, pg_cron — one platform instead of splitting across providers. Netlify serves only static files. No vendor lock-in on the compute layer (Edge Functions are standard Deno, easily portable to Hono/Cloudflare).

**RSS fallback for Reddit.** Reddit blocks cloud IPs from their JSON API. Rather than being blocked, we fall back to RSS feeds which are reliable from all IPs. Trade-off: less metadata per post, but sufficient for LLM analysis. OAuth upgrade path is ready in code.

**LLM over embeddings for MVP.** gpt-4o-mini at $0.15/1M input tokens costs ~$0.01 per daily report. Delivers nuanced analysis with actionable hypotheses. Embeddings + clustering deferred until longitudinal data justifies the infrastructure.

**Provider-agnostic AI.** `AIAnalysisService` interface abstracts OpenAI — swap to Anthropic, local LLM, or any provider by implementing one interface.

**Storybook-ready UI.** All shared/ui components are self-contained with typed props — ready for extraction into a design system package.

**Persisted client settings.** Subreddit selection and email recipients stored in Zustand with localStorage persistence — settings survive page reloads and are sent to the Edge Function per request.

## Answers to Mandatory Questions

### Which signals are most valuable for SDG Lab?

1. **Unmet needs with emotional urgency** — when users express pain with strong emotion around companionship, emotional support, or communication barriers. These are direct product opportunity signals. Example: "I wish there was an app where I could just talk to someone at 3am without judgment" — this is a spec, not just a complaint.

2. **Behavioral shifts in coping mechanisms** — when users collectively adopt new patterns (AI chatbots for loneliness, Discord support groups, anonymous peer matching). Shows organic market movement that SDG Lab can build on or improve upon.

3. **Negative sentiment toward existing solutions** — frustration with therapy apps ("too expensive", "feels robotic"), dating apps ("makes loneliness worse"), social media ("comparison trap"). Reveals gaps for differentiated positioning and concrete feature requirements.

### How to make this a competitive advantage?

- **Speed:** Daily signals vs. quarterly research reports. Detect a pain point Monday, scope an MVP Tuesday, ship by Friday. Competitors do annual user research.
- **Domain tuning:** Prompts, subreddit selection, and signal taxonomy are tuned specifically to SDG Lab's verticals (loneliness, emotional support, p2p communication). Generic trend tools miss the nuance.
- **Historical memory:** The longitudinal dataset of daily pain point evolution becomes a moat over time — you can see not just today's problems but how they shift month over month.
- **Hypothesis-to-backlog pipeline:** Every output is actionable ("Because users report X, build Y"), not just informational. Product decisions flow directly from data.

### How to automate trend-to-MVP pipeline?

1. **Phase 1 (current):** Structured daily reports → human reads, prioritizes, creates tickets
2. **Phase 2:** Scoring system `opportunity = strength × domain_fit × competition_gap × urgency` → auto-ranked hypotheses delivered to Slack with priority scores
3. **Phase 3:** AI-generated product specs from approved hypotheses — personas, user stories, MVP scope, technical architecture sketch
4. **Phase 4:** Full loop: detect signal → score → generate spec → create repo from template → assign team. Human approval at gates only.

## License

Internal tool — SDG Lab proprietary.

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

### Database Setup (Supabase SQL Editor)

```sql
-- Reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date_from timestamptz,
  date_to timestamptz,
  subreddits text[],
  total_posts_analyzed int,
  summary text,
  signals jsonb,
  raw_post_count jsonb
);

alter table public.reports enable row level security;
create policy "Allow all" on public.reports for all using (true) with check (true);

-- Settings table (synced from UI, read by pg_cron)
create table if not exists public.app_settings (
  id text primary key default 'global',
  subreddits text[] not null default '{lonely,depression,socialskills}',
  email_recipients text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values ('global') on conflict do nothing;

alter table public.app_settings enable row level security;
create policy "Allow all" on public.app_settings for all using (true) with check (true);
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

When pg_cron triggers with an empty body, the Edge Function reads subreddits and email recipients from `app_settings` — so changes made in the UI are reflected in automated daily reports.

## Architecture

```
┌──────────────────────────────────────────┐
│            Frontend (SPA)                 │
│   React 19 + TS + Vite + Tailwind v4    │
│   Feature Sliced Design (FSD)            │
│   Zustand (persisted settings)           │
└──────────────┬───────────────────────────┘
               │ supabase.functions.invoke()
               │ + settings sync (app_settings table)
    ┌──────────┴──────────────┐
    │       Supabase           │
    │  Edge Function (Deno)    │ ← pg_cron daily at 09:00 UTC
    │  PostgreSQL              │ ← Reports + Settings storage
    │  pg_cron + pg_net        │ ← Schedule trigger
    └──────────┬──────────────┘
        ┌──────┴──────┐───────────┐
        │ Reddit RSS  │ OpenAI    │ Brevo (email)
        └─────────────┘───────────┘
```

### Data Pipeline (Edge Function)

```
Reddit RSS/API  →  Parse posts (titles + body, no comments)  →  OpenAI gpt-4o-mini  →  Structured JSON
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
│   ├── api/          # Supabase client, report storage, settings storage
│   ├── ui/           # Reusable components (Button, Card, Badge, Skeleton)
│   ├── lib/          # Types, Zustand store, report-diff, utilities
│   └── config/       # App configuration
└── test/             # Test setup
```

### Reddit Data Access

Reddit blocks API requests from cloud provider IPs. The Edge Function uses a 3-tier fallback:

1. **Reddit OAuth** (when credentials available) — official API with full access to posts/comments
2. **Direct JSON API** — works locally, blocked from most cloud IPs
3. **RSS feed** — `reddit.com/r/{sub}/hot.rss` — reliable from cloud IPs, limited metadata but sufficient for MVP analysis

When Reddit OAuth credentials are obtained (requires approved Reddit app), the system automatically upgrades to full API access with richer data.

### AI Analysis: Why LLM, Not Embeddings

The core question: how to extract actionable signals from ~100 Reddit posts daily?

**Option A: Embeddings + Clustering** — convert each post to a vector, cluster similar posts, measure cluster growth over time. Gives quantitative precision ("topic X grew 340% in 7 days") but requires: vector DB (pgvector/Pinecone), embedding pipeline, cluster tuning (min_cluster_size, epsilon), dimensionality reduction for visualization, and a separate step to interpret clusters into human-readable signals.

**Option B: LLM analysis (chosen)** — feed posts directly to gpt-4o-mini with a structured prompt. The model reads, interprets, and outputs categorized signals in one pass.

Why LLM wins for MVP:

| Criteria | LLM | Embeddings + Clustering |
|---|---|---|
| Understands sarcasm, tone, subtext | Yes | No — treats "I love being alone /s" as positive |
| Generates product hypotheses | Yes — reasons about *what to build* | No — only groups similar posts |
| Time to ship | Hours (prompt engineering) | Weeks (infra + tuning) |
| Infrastructure | One API call | Vector DB + embedding pipeline + cluster jobs |
| Cost per report | ~$0.01 (gpt-4o-mini) | ~$0.005 embeddings + DB hosting |
| Cross-day comparison | Via Report Diff (UI) | Native (vector similarity) |

**The 80/20 rule:** LLM gives 80% of the value (actionable signals with context) for 20% of the effort. Embeddings add the remaining 20% of value (quantitative precision, anomaly detection) but require 80% more infrastructure.

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

When the system accumulates 30+ days of reports and the team needs quantitative rigor, add:

**Embeddings** (vector representations of post meaning via `text-embedding-3-small`):

- **Cross-day semantic tracking** — "was this topic discussed last week?" becomes a cosine similarity query, not a keyword match. Catches paraphrases: "lonely in new city" / "moved, no friends" / "isolated after relocation" = same signal.
- **Anomaly detection** — measure when a topic cluster grows 10x in 24h. LLM estimates growth qualitatively; embeddings measure it mathematically.
- **Deduplication** — posts across subreddits about the same topic get grouped automatically.
- **Infrastructure:** pgvector extension in Supabase (already available), ~$0.002/1K posts for embedding generation.

**Clustering** (HDBSCAN / k-means on embeddings):

- **Long-term trend visualization** — 30-day topic evolution charts. See which pain points persist vs. which are one-off spikes.
- **New topic discovery** — posts that don't fit any existing cluster = genuinely emerging signals. More reliable than LLM judgment for "is this really new?"
- **Topic landscape maps** — 2D scatter plots (via UMAP dimensionality reduction) showing what communities discuss and how topics relate to each other.
- **Infrastructure:** Python job (scheduled or on-demand), HDBSCAN for density-based clustering, UMAP for visualization.

**When to add:** After 30+ daily reports exist in the DB and the team wants to answer "how did this pain point evolve over the last month?" — a question LLM analysis alone can't answer reliably.

## Report Format

Each report is designed to be **short and actionable** — a founder should be able to read it in 2 minutes and know what to build next.

### Structure

1. **Executive Summary** (2-3 sentences) — leads with the most important finding, not generic phrasing
2. **Signals** grouped by category (see below) — each grounded in specific post evidence
3. **Report Comparison** (dashboard only) — diff vs. previous report: new/gone/intensified/weakened signals
4. **Top Discussed Posts** (email only) — 15 most engaged posts with direct Reddit links for verification

### Signal Categories

| Category | What it captures | Example |
|---|---|---|
| 🆕 **Emerging Topics** | Themes appearing for the first time or gaining initial traction | "AI companions as 3am emotional support" |
| 📈 **Growing Trends** | Topics accelerating vs. baseline (with estimated % growth) | "Discord support groups replacing therapy apps (+45%)" |
| 😰 **Pain Points** | Specific user frustrations with unmet needs a product could address | "Users report therapy apps feel robotic and scripted" |
| 💡 **Product Hypotheses** | Actionable ideas linked to pain points above | "Because users want human-like support at odd hours, a product that matches peers by timezone could reduce late-night loneliness" |

### Signal Fields

Each signal includes:
- **Title** — short (5-8 words), descriptive
- **Description** — what's happening AND why it matters, referencing observed post patterns
- **Strength** — high (10+ posts with strong engagement), medium (3-9), low (1-2 emerging)
- **Sentiment** — positive / negative / mixed / neutral
- **Post count** — how many posts support this signal
- **Subreddits** — which communities generated this signal
- **Growth %** — estimated vs. normal volume (when applicable)

Email reports additionally include links to the top 15 most discussed posts for quick verification.

## Key Design Decisions

**Supabase as unified backend.** Edge Functions, PostgreSQL, pg_cron — one platform instead of splitting across providers. Netlify serves only static files. No vendor lock-in on the compute layer (Edge Functions are standard Deno, easily portable to Hono/Cloudflare).

**RSS fallback for Reddit.** Reddit blocks cloud IPs from their JSON API. Rather than being blocked, we fall back to RSS feeds which are reliable from all IPs. Trade-off: less metadata per post, but sufficient for LLM analysis. OAuth upgrade path is ready in code.

**LLM over embeddings for MVP.** gpt-4o-mini at $0.15/1M input tokens costs ~$0.01 per daily report. Delivers nuanced analysis with actionable hypotheses. Embeddings + clustering deferred until longitudinal data justifies the infrastructure.

**Brevo for email delivery.** Chosen over Resend (recipient restrictions on free tier) and Gmail SMTP (auth complexity in Deno). Brevo's free tier allows 300 emails/day to any recipient without domain verification — sufficient for an internal tool. REST API works natively in Deno Edge Functions. Recipients are configurable from the UI.

**Storybook-ready UI.** All shared/ui components are self-contained with typed props — ready for extraction into a design system package.

**Settings synced to DB.** Subreddit selection and email recipients are persisted both in localStorage (instant UI) and Supabase `app_settings` table. This ensures pg_cron uses the same settings configured in the UI — no manual env variable changes needed.

**Dev/prod auto-detection.** `VITE_FUNCTIONS_URL` in `.env.local` routes to local Edge Functions during development. Production builds ignore it automatically (`import.meta.env.DEV` guard) — no manual switching needed.

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

## Future Improvements

- **Authentication & roles** — currently the dashboard is public. Add Supabase Auth (email/magic link) with role-based access: `admin` (full access, settings, report generation), `viewer` (read-only dashboard). RLS policies on `reports` and `app_settings` tables should restrict access to authenticated users only. Edge Function should validate JWT for manual triggers.
- **Analytics page** — charts built with Recharts directly in the dashboard: post volume over 30 days, signal category distribution, recurring topic heatmap. All data already exists in Supabase `reports` table.
- **Embeddings + clustering** — pgvector for cross-day semantic similarity, HDBSCAN for long-term topic discovery (see [Scaling Beyond MVP](#scaling-beyond-mvp-embeddings--clustering))
- **Slack integration** — daily report delivery to a Slack channel alongside email
- **Reddit OAuth + comment analysis** — full API access when approved; enables fetching top comments per post for deeper sentiment analysis (currently only post titles and body text are analyzed, comments are not fetched due to RSS limitations)
- **Opportunity scoring** — auto-rank hypotheses by `strength × domain_fit × competition_gap × urgency`
- **Error monitoring** — Sentry for frontend + Edge Function alerting

## License

Internal tool — SDG Lab proprietary.

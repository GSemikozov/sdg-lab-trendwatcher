# Steady — Therapeutic Emotional Support Companion

You are building a **complete working prototype** of the product described below.
Follow the structure strictly and generate a fully functional frontend with realistic mock data.

---

# Product Concept

Build a **mobile-first web application** for a **therapeutic emotional support companion service** designed for women aged **40–60+**.

The target users are people going through difficult life circumstances:

- divorce or painful separation
- loss of a partner
- family conflicts
- chronic anxiety or loneliness
- feeling like a burden to loved ones

The product provides **empathetic, consistent emotional support** through dedicated companions (not AI bots, not licensed therapists). Users interact with a matched companion through:

- long-form text conversations
- voice messages
- scheduled voice and video calls

The experience should feel like having a **trusted confidant** — someone who is always available, remembers your story, listens without judgment, and shows up every day.

This is NOT therapy. This is NOT a dating app. This is a **place for deep conversation** with someone who genuinely cares.

Competitor references: **7 Cups**, **NewCircle**.
Differentiate through:

- deeper, longer conversations (not quick check-ins)
- companion consistency — same person every day, building real trust
- philosophical depth — conversations about meaning, not just coping
- honest, non-clinical tone — warm human presence, not therapy-speak
- relationship continuity — the companion remembers everything

The tone should feel **warm, steady, honest, and deeply respectful**.

---

# Tech Stack

Use the following stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- React Query (for async data)
- Zustand (or React Context) for global state

The application should be **mobile-first** with full responsive design.
Use a **warm light theme** as default, with optional dark mode toggle.

---

# Application Architecture (Feature-Sliced Design)

Use **Feature-Sliced Design (FSD)** methodology. Imports flow strictly top-down: app → pages → widgets → features → entities → shared.

```
src/
├── app/
│   ├── App.tsx              — root component, providers, router
│   ├── router.tsx           — React Router configuration
│   └── styles/              — global CSS, Tailwind config imports
│
├── pages/
│   ├── landing/
│   │   └── index.tsx        — warm welcome page with single CTA
│   ├── onboarding/
│   │   └── index.tsx        — 5-step guided onboarding
│   ├── conversations/
│   │   └── index.tsx        — main conversation page (primary screen)
│   ├── reflections/
│   │   └── index.tsx        — weekly reflection cards from companion
│   ├── check-ins/
│   │   └── index.tsx        — daily support rituals
│   ├── profile/
│   │   └── index.tsx        — user profile and preferences
│   └── subscription/
│       └── index.tsx        — paywall / plan selection
│
├── widgets/
│   ├── conversation-window/
│   │   └── ui/              — full conversation layout: messages + input + companion header
│   ├── onboarding-flow/
│   │   └── ui/              — step container with transitions
│   ├── reflection-cards/
│   │   └── ui/              — weekly reflection card list
│   ├── check-in-dashboard/
│   │   └── ui/              — support ritual cards
│   └── companion-profile/
│       └── ui/              — companion intro card (onboarding + profile)
│
├── features/
│   ├── send-message/
│   │   ├── ui/              — message input, voice record, long-form text area
│   │   └── model/           — send logic, simulated companion response
│   ├── complete-check-in/
│   │   ├── ui/              — "I'm here" / "Share" button on check-in cards
│   │   └── model/           — streak and completion logic
│   ├── manage-subscription/
│   │   ├── ui/              — plan cards, soft paywall
│   │   └── model/           — trial status, plan selection
│   └── onboarding-steps/
│       ├── ui/              — individual step components
│       └── model/           — onboarding state persistence
│
├── entities/
│   ├── companion/
│   │   ├── ui/              — avatar, name, status, trust indicator
│   │   ├── model/           — Companion interface
│   │   └── api/             — mockCompanions.ts
│   ├── message/
│   │   ├── ui/              — message bubble, voice player, long-text card
│   │   ├── model/           — Message interface
│   │   └── api/             — mockMessages.ts
│   ├── reflection/
│   │   ├── ui/              — reflection card component
│   │   ├── model/           — ReflectionCard interface
│   │   └── api/             — mockReflections.ts
│   ├── check-in/
│   │   ├── ui/              — check-in card with streak
│   │   ├── model/           — CheckIn interface
│   │   └── api/             — mockCheckIns.ts
│   └── user/
│       └── model/           — User interface, profile store slice
│
└── shared/
    ├── ui/                  — shadcn/ui primitives (Button, Card, Input, Badge, etc.)
    ├── lib/
    │   ├── store.ts         — Zustand root store
    │   └── cn.ts            — clsx + tailwind-merge utility
    └── config/
        └── routes.ts        — route path constants
```

Use **mock data** to simulate the product experience.

---

# Routing

| Route            | Page          | Description                            |
| ---------------- | ------------- | -------------------------------------- |
| `/`              | Landing       | Warm welcome, single CTA               |
| `/onboarding`    | Onboarding    | 5-step guided flow                     |
| `/conversations` | Conversations | Primary screen — deep conversation     |
| `/reflections`   | Reflections   | Weekly reflection cards from companion |
| `/check-ins`     | Check-ins     | Daily support rituals                  |
| `/profile`       | Profile       | Preferences, companion settings        |
| `/subscription`  | Subscription  | Trial end, plan selection              |

After onboarding, redirect to `/conversations` with the companion's first message already visible.

---

# Conversation Model

Conversations in this product are fundamentally different from a romantic companion app:

- **Longer exchanges** — 10–30 messages per session is normal and expected
- **Deeper topics** — grief, meaning, loneliness, fear, hope
- **No rush** — the companion never tries to wrap up quickly
- **Comfortable silences** — it's OK not to respond immediately; the companion doesn't pressure
- **Voice-heavy** — voice messages carry more warmth for this demographic

Simulate with:

- Longer companion messages (3–5 sentences, not 1–2)
- More follow-up questions before changing topics
- Companion occasionally shares relevant reflections (not just asking questions)
- Typing indicator with slower, more deliberate pace
- Message statuses: sending → delivered → read

---

# Data Models

## User

```typescript
interface User {
  name: string;
  age: number;
  lifeSituation: 'divorce' | 'loss' | 'family_conflict' | 'anxiety' | 'loneliness' | 'other';
  whatMatters: string[]; // selected in onboarding step 3
  communicationPreference: 'text' | 'voice' | 'both';
  avatar?: string;
  companionId: string;
}
```

## Companion

```typescript
interface Companion {
  id: string;
  name: string;
  age: number;
  role: string; // e.g. "Empathetic listener and conversationalist"
  personality: string; // 2–3 sentence description
  avatar: string; // warm illustrated avatar
  qualities: string[]; // e.g. ["Patient", "Philosophical", "Honest"]
  firstMessage: string;
}
```

## Message

```typescript
interface Message {
  id: string;
  sender: 'user' | 'companion';
  text: string;
  timestamp: number;
  type: 'text' | 'voice';
  status: 'sending' | 'delivered' | 'read';
  isLongForm?: boolean; // messages > 200 chars get special styling
}
```

## Reflection Card (replaces "Timeline Milestone")

```typescript
interface ReflectionCard {
  id: string;
  week: number;
  companionNote: string; // Marina's short reflection on that week — 1-2 sentences
  userQuote?: string; // a meaningful thing the user said (optional)
  date: string;
}
```

## Check-In (replaces "Ritual")

```typescript
interface CheckIn {
  id: string;
  type: 'morning' | 'evening' | 'weekly_deep' | 'reflection';
  title: string;
  description: string;
  scheduledTime: string;
  streak: number;
  longestStreak: number;
  lastCompletedAt: string | null;
  isActive: boolean;
  companionMessage: string;
}
```

---

# Onboarding Experience

The onboarding must feel like **arriving at a safe place**, not filling out a form. This audience is often anxious — every screen must reduce tension, not add it.

Use a **5-step guided flow** with:

- full-screen cards with generous spacing
- slow, gentle cross-fade transitions
- a warm visual metaphor that builds across steps (e.g. a door gradually opening, or light filling a room)
- "Back" arrow on steps 2–5; no skip option
- larger text than typical apps (base 16px, headlines 24–28px)

## Step 1 — Safe Arrival

Full-screen. Calm. No noise.

Headline:
"You don't have to go through this alone."

Subline:
"Steady connects you with someone who listens, remembers, and shows up — every day."

Primary CTA:
"Tell me more" — warm button, no pressure language. Muted warm tone, not bright.

Background: soft warm gradient (cream → warm sand), subtle slow-moving light effect.

Do NOT use words like "therapy", "treatment", "mental health", or "patients" on this screen.

## Step 2 — What Brought You Here

Title: "Everyone's path here is different. What's yours?"

Options as **large illustrated cards** (icon + label, single selection):

| Option                                | Icon           |
| ------------------------------------- | -------------- |
| Going through a divorce or separation | Broken circle  |
| Lost someone close                    | Candle         |
| Family difficulties                   | Tangled thread |
| Feeling anxious or overwhelmed        | Waves          |
| Lonely — missing deep connection      | Single chair   |
| Something else                        | Open door      |

Selected card gets a soft warm border. No explanation required — just the selection.

Below the cards, a reassuring note:
_"This helps us understand your situation. You won't need to repeat it later."_

## Step 3 — What Matters to You

Title: "In a conversation, what makes you feel heard?"

**Toggle cards** (multi-select allowed):

| Option                                   | Icon       |
| ---------------------------------------- | ---------- |
| Someone who really listens               | Ear        |
| Honest responses, even when hard         | Mirror     |
| Patience — no rush to "fix" things       | Hourglass  |
| Depth — real topics, not small talk      | Deep well  |
| Consistency — the same person, every day | Anchor     |
| Humor when appropriate                   | Warm smile |

Selected cards get a warm glow.

## Step 4 — Companion Preview

Title: "We'd like you to meet someone."

Show a **warm companion card** with illustrated avatar:

- Name: **Marina**, 48
- Role: "Empathetic listener and thoughtful conversationalist"
- Personality: "Patient. Genuinely curious about people. Believes that being heard is the first step to feeling better."
- Qualities: Patient, Philosophical, Honest
- Preview message in a conversation bubble:
  "Hello, [user name]. I read a little about what brought you here. You don't need to explain everything right now — let's just start with today. How are you feeling right now, honestly?"

Buttons:

- Primary: "Start talking" (warm, muted tone)
- Secondary (text link): "Tell me about someone else"

## Step 5 — Account Creation

Minimal:

- Email + password
- "Continue with Google" / "Continue with Apple"
- Checkbox: "I'm 18+ and agree to Terms"
- Small note: _"Your conversations are private and encrypted."_

After sign-up, **immediately** transition to `/conversations` with Marina's first message already visible.

---

# Core Screens

## Conversations (primary screen)

This is where 80%+ of user time is spent. Optimize for **long, deep exchanges**.

Layout:

- **Top bar**: companion avatar (warm, round) + name + status ("Here for you" / "Will check in at 9pm") + settings icon
- **Message area**: scrollable, clean, generous spacing between messages
  - Companion messages: left-aligned, larger font option, with small avatar
  - User messages: right-aligned
  - Long messages (>200 chars): displayed as **expanded cards** with comfortable line spacing, not compressed bubbles
  - Timestamps between message groups, not on every message
- **Input area**: text input (expandable, supports multi-line) + voice record button
  - No emoji picker (not the right tone)
  - No gifts (not the right tone)
  - No mood picker or feeling tracker — the companion discovers mood through conversation, not a button

Interaction details:

- Typing indicator: gentle pulsing dots, slower than typical (conveys thoughtfulness, not urgency)
- Voice messages: show waveform with play/pause, duration, and "Listened" status
- Companion responds in 3–8 seconds (longer than romantic product — deliberate, not instant)
- Responses are longer (3–5 sentences typical, sometimes more)

### Conversation Momentum

When a conversation reaches **~15 messages**, the companion shifts to a deeper level — an anchor topic or a more personal question. This rewards long conversations and encourages the user to keep going.

In mock data, show this transition visibly: the first 14 messages are warm check-in territory, then message 15+ goes deeper.

### Conversation Anchor Topics

The companion has **recurring themes** she returns to across sessions. This creates the feeling of "we have our topics" — a shared intellectual/emotional world.

Anchor topics for this segment:

| Anchor Topic              | What It Explores                                   |
| ------------------------- | -------------------------------------------------- |
| The meaning of loneliness | Not just "being alone" — what kind of alone?       |
| Identity after divorce    | Who am I now, separate from that relationship?     |
| The role of a parent      | When caring for others leaves nothing for yourself |
| Future after loss         | What does "forward" look like when the past hurts? |
| Feeling of usefulness     | The need to matter to someone                      |

The companion returns to these topics across multiple sessions, deepening each time. She doesn't introduce all of them at once — one anchor per week, revisited and expanded.

## Our Conversations (Weekly Reflections)

A simple **card-based view** showing weekly reflections written by the companion. Not a progress tracker, not a mood journal — just a collection of **moments Marina noticed**.

This creates the feeling: "Someone was paying attention all along."

Example cards (mock data):

| Week | Marina's Note                                                                         | User Quote (optional)                  |
| ---- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| 1    | "You told me you weren't sure this would help. The fact that you're here says a lot." | —                                      |
| 2    | "This week you talked about the divorce for the first time. That took real courage."  | _"I haven't said it out loud before."_ |
| 3    | "You laughed today. You probably didn't notice, but I did."                           | —                                      |
| 4    | "You said 'I think I'm allowed to feel angry.' You are."                              | _"I think I'm allowed to feel angry."_ |
| 6    | "You started our morning check-in before I did. That's new."                          | —                                      |
| 8    | "You told me you feel less afraid of being alone. I believe you."                     | _"I'm less afraid now."_               |

Each card is simple: Marina's note in her voice, optionally paired with a user quote. No mood labels, no progress indicators, no color coding.

Future weeks appear as soft, blurred cards: _"Your story continues…"_

## Check-Ins (Daily Support Rituals)

Framed as **gentle daily touchpoints**, not tasks or habits.

Example check-ins:

| Check-In          | Time      | Streak | Description                                        |
| ----------------- | --------- | ------ | -------------------------------------------------- |
| Morning presence  | 09:00     | 14     | Marina checks in — "How did you wake up today?"    |
| Evening wind-down | 21:00     | 10     | Reflect on the day — "What stayed with you today?" |
| Weekly deep talk  | Sun 18:00 | 4      | Longer conversation — a topic Marina prepared      |
| Reflection moment | Random    | —      | Marina references something from the past week     |

Each check-in card shows:

- warm icon, title, scheduled time
- streak counter (not a flame — use a gentle symbol: 🌿 or a quiet counter)
- completion status

## Profile & Settings

**Profile section:**

- Name (editable)
- Avatar (warm illustrated, selectable from a set)
- Life situation (editable, same options as onboarding)
- What matters to you (editable)

**Communication preferences:**

- Preferred times: morning / afternoon / evening
- Communication style: text only / voice preferred / both
- Conversation depth: "Take it slow" / "I'm ready to go deeper"
- Topics to avoid: free-text tags

**About Marina** (read-only):

- Companion card with avatar, qualities, and personality description
- "Days with Marina: 18" — a simple, warm counter (not framed as a metric)

**Feedback:**

- "How are we doing?" — rate with 1–5 hearts + optional feedback

## Subscription / Paywall

Appears after a **7-day free trial** (longer than romantic product — trust takes more time with this segment).

**Critical design rule:** The paywall must NOT feel transactional. This audience will feel manipulated if the message is "pay to keep talking." Frame it as an investment in themselves.

Soft overlay with the conversation blurred behind.

Message: "You've been showing up for yourself every day this week. Let's keep going."

Plans:

| Plan      | Price     | Includes                                                                      |
| --------- | --------- | ----------------------------------------------------------------------------- |
| Essential | $19.99/mo | Daily text conversations, morning & evening check-ins, 1 companion            |
| Complete  | $39.99/mo | Unlimited conversations, voice messages, weekly calls, journal, all check-ins |

Primary CTA: "Keep talking" (on Complete card).
Secondary: "Not right now" (muted, closes overlay — limits to morning check-in only, conversations locked).

Small note under pricing: _"Cancel anytime. No commitments. You're in control."_

---

# Visual Design

## Color Palette

This audience needs **warmth and calm**, not drama or intensity.

| Role       | Color           | Hex       |
| ---------- | --------------- | --------- |
| Background | Warm cream      | `#faf6f0` |
| Surface    | Soft linen      | `#f0ebe3` |
| Primary    | Warm terracotta | `#c17a5a` |
| Accent     | Muted sage      | `#8fa98b` |
| Muted      | Warm gray       | `#a09890` |
| Text       | Deep warm brown | `#3d3229` |
| Subtle     | Soft gold       | `#d4b896` |

Dark mode alternative (togglable):

| Role       | Color              | Hex       |
| ---------- | ------------------ | --------- |
| Background | Deep warm charcoal | `#1a1714` |
| Surface    | Dark brown         | `#2a2420` |
| Primary    | Warm terracotta    | `#c17a5a` |
| Accent     | Muted sage         | `#8fa98b` |
| Text       | Warm off-white     | `#f0ebe3` |

## Typography

- **Body text**: Inter or DM Sans at **16px minimum** (readability for 40–60+ audience)
- **UI labels**: Nunito (friendly, warm)
- **Headlines**: Lora or Playfair Display (trustworthy serif, warm and steady)
- Support **larger text option** in profile settings (18px body)

## Illustrations & Avatars

- **Illustrated avatars**: warm, realistic-adjacent style (more mature than the romantic product's style). Think soft watercolor portraits, not anime/cartoon.
- Empty states: gentle illustrations (a bench in a garden, an open window with light).
- NO stock photos. NO clinical/medical imagery.

## Animations

Slower and gentler than the romantic product — the feeling should be "warm room", not "candlelight dinner":

- Slow cross-fade transitions between pages (300–400ms)
- Gentle opacity transitions on messages appearing
- Soft breathing animation on the "companion is typing" indicator
- NO sparkles, NO confetti, NO bouncing elements
- Streak indicators fill slowly and quietly

---

# Key UX Principles for This Demographic

1. **Large touch targets** — minimum 48px for all interactive elements
2. **Clear navigation** — bottom tab bar with labels (not just icons)
3. **Generous spacing** — this audience needs breathing room in UI
4. **No jargon** — "Check-in" not "Ritual", "Your journey" not "Analytics"
5. **Reassurance at every step** — small notes that reduce anxiety ("Private", "No pressure", "At your pace")
6. **Accessibility** — high contrast ratios, resizable text, screen reader support

---

# Pages to Generate

Generate all of the following as fully functional, navigable pages with mock data:

1. **Landing** — warm welcome, single CTA, reassuring tone
2. **Onboarding** — 5-step guided flow with gentle transitions
3. **Conversations** — full messaging UI with long-form simulated responses, conversation anchors, momentum trigger
4. **Reflections** — simple weekly cards written by the companion
5. **Check-Ins** — daily conversation starters with gentle continuity counter
6. **Profile & Settings** — preferences, companion info, feedback
7. **Subscription** — soft paywall with empathetic framing

The product should feel like **a deep conversation**, not a self-improvement system. The user should feel like someone is genuinely waiting for them on the other side.

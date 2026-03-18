# Romantic Core — Virtual Romantic Companion Service

You are building a **complete working prototype** of the product described below.
Follow the structure strictly and generate a fully functional frontend with realistic mock data.

---

# Product Concept

Build a **mobile-first web application** for a **virtual romantic companion service** designed for women aged **25–45**.

The product provides **emotionally engaging romantic experiences** through real human companions (not AI bots). Users interact with a matched companion through:

- daily text conversations
- voice messages
- scheduled video calls

The experience should feel like a **gradually evolving relationship** with emotional progression, daily rituals, and shared memories.

Competitor reference: **JOI (joi.com)**.
Differentiate through:

- deeper emotional progression
- relationship timeline
- daily rituals
- warmer visual design

The tone should feel **romantic, safe, and emotionally supportive**.

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
Dark mode should be **default**.

---

# Application Architecture (Feature-Sliced Design)

Use **Feature-Sliced Design (FSD)** methodology. Organize code into layers, where each layer has a clear responsibility. Imports flow strictly top-down: app → pages → widgets → features → entities → shared.

```
src/
├── app/
│   ├── App.tsx              — root component, providers, router setup
│   ├── router.tsx           — React Router configuration with all routes
│   └── styles/              — global CSS, Tailwind config imports
│
├── pages/
│   ├── landing/
│   │   └── index.tsx        — emotional hook landing page
│   ├── onboarding/
│   │   └── index.tsx        — 5-step guided onboarding flow
│   ├── chat/
│   │   └── index.tsx        — main conversation page
│   ├── timeline/
│   │   └── index.tsx        — relationship milestone timeline
│   ├── rituals/
│   │   └── index.tsx        — daily rituals dashboard
│   ├── profile/
│   │   └── index.tsx        — user profile and settings
│   └── subscription/
│       └── index.tsx        — paywall / plan selection
│
├── widgets/
│   ├── chat-window/
│   │   └── ui/              — full chat layout: message list + input bar + top bar
│   ├── onboarding-wizard/
│   │   └── ui/              — step container with transitions and progress
│   ├── timeline-feed/
│   │   └── ui/              — vertical timeline with milestone cards
│   ├── ritual-dashboard/
│   │   └── ui/              — ritual cards grid with streak indicators
│   └── companion-card/
│       └── ui/              — companion preview card (used in onboarding + profile)
│
├── features/
│   ├── send-message/
│   │   ├── ui/              — message input bar, voice record button, gift picker
│   │   └── model/           — send logic, simulated companion response with delay
│   ├── complete-ritual/
│   │   ├── ui/              — "Respond" / "Complete" button on ritual cards
│   │   └── model/           — streak update logic
│   ├── select-companion/
│   │   ├── ui/              — "Show me someone else" interaction
│   │   └── model/           — companion switching logic
│   ├── manage-subscription/
│   │   ├── ui/              — plan cards, "Continue our story" CTA
│   │   └── model/           — trial status, plan selection
│   └── onboarding-steps/
│       ├── ui/              — individual step components (hook, about-you, preferences, preview, signup)
│       └── model/           — onboarding state persistence across steps
│
├── entities/
│   ├── companion/
│   │   ├── ui/              — avatar, name badge, status indicator, tag chips
│   │   ├── model/           — Companion interface, companion store slice
│   │   └── api/             — mockCompanions.ts
│   ├── message/
│   │   ├── ui/              — message bubble, typing indicator, voice player, gift animation
│   │   ├── model/           — Message interface, message store slice
│   │   └── api/             — mockMessages.ts
│   ├── milestone/
│   │   ├── ui/              — milestone card (unlocked / locked states)
│   │   ├── model/           — Milestone interface
│   │   └── api/             — mockTimeline.ts
│   ├── ritual/
│   │   ├── ui/              — ritual card with streak counter and reward indicator
│   │   ├── model/           — Ritual interface
│   │   └── api/             — mockRituals.ts
│   └── user/
│       └── model/           — User interface, user profile store slice
│
└── shared/
    ├── ui/                  — design-system primitives (Button, Card, Input, Badge, etc. via shadcn/ui)
    ├── lib/
    │   ├── store.ts         — Zustand root store combining all slices
    │   └── cn.ts            — clsx + tailwind-merge utility
    └── config/
        └── routes.ts        — route path constants
```

**Key FSD rules for this project:**

- Each slice (folder inside a layer) has `ui/`, `model/`, and optionally `api/` segments.
- `shared/ui` contains only generic, domain-free components (shadcn primitives).
- `entities` define domain objects — their types, mock data, and small UI pieces (e.g. a single message bubble).
- `features` combine entities into user actions (e.g. "send message" uses the message entity).
- `widgets` compose features and entities into larger UI blocks (e.g. "chat window" = message list + send-message feature + companion header).
- `pages` assemble widgets into full screens and connect them to routing.

Use **mock data** in entity `api/` segments to simulate the product experience.

---

# Routing

Use React Router with these routes:

| Route           | Page                  | Description                    |
| --------------- | --------------------- | ------------------------------ |
| `/`             | Landing               | Emotional hook, single CTA     |
| `/onboarding`   | Guided onboarding     | 5-step flow                    |
| `/chat`         | Main conversation     | Primary interaction screen     |
| `/timeline`     | Relationship timeline | Milestone progression          |
| `/rituals`      | Daily rituals         | Morning/evening/weekly moments |
| `/profile`      | Profile & settings    | Preferences, avatar, frequency |
| `/subscription` | Paywall               | Trial end, plan selection      |

After onboarding completion, redirect to `/chat` with the companion's first message already visible.

---

# Real-Time Interaction Model

The companion should feel **alive and responsive**.

Simulate real-time interaction with:

- typing indicator (animated dots with a subtle heartbeat rhythm, not standard "...")
- delayed companion responses (1–3 seconds after user sends a message)
- message history persisted in local state
- message statuses: sending → delivered → read (with subtle visual transitions)
- scheduled messages that simulate daily rituals (e.g. morning greeting appears at a set time)

When the user opens the chat after being away, show a **"missed" companion message** that arrived while they were gone — this creates the feeling of a living relationship.

---

# Data Models

## User

```typescript
interface User {
  name: string;
  age: number;
  emotionalState: 'lonely_hopeful' | 'healing' | 'tired_of_swiping' | 'curious';
  preferences: string[]; // selected in onboarding step 3
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
  personality: string; // 1–2 sentence description
  avatar: string; // illustrated avatar URL or placeholder
  tags: string[]; // e.g. ["Romantic", "Morning person", "Thoughtful"]
  firstMessage: string; // personalized with user's name
}
```

## Message

```typescript
interface Message {
  id: string;
  sender: 'user' | 'companion';
  text: string;
  timestamp: number;
  type: 'text' | 'voice' | 'gift';
  status: 'sending' | 'delivered' | 'read';
  giftType?: string; // e.g. "flower", "letter", "song"
}
```

## Timeline Milestone

```typescript
interface Milestone {
  id: string;
  day: number; // day in the relationship
  title: string;
  description: string;
  date: string;
  unlocked: boolean; // false = shown as blurred/locked
  icon: string; // e.g. "heart", "phone", "calendar", "star"
}
```

## Ritual

```typescript
interface Ritual {
  id: string;
  name: string; // e.g. "Morning Greeting"
  description: string;
  time: string; // e.g. "09:00"
  streak: number;
  lastCompleted?: string;
  icon: string;
}
```

---

# Onboarding Experience

The onboarding should feel like **the beginning of a romantic story**, not a registration form.

Use a **5-step guided flow** with:

- full-screen cards
- smooth cross-fade or slide transitions between steps
- a soft animated element that grows with progress (e.g. a glowing candle flame or blooming flower) instead of a standard progress bar
- "Back" arrow on steps 2–5; no skip option

## Step 1 — Emotional Hook

Full-screen cinematic intro.

Headline:
"What if someone wrote to you first every morning?"

Subline:
"Not a dating app. Not a chatbot. A real person who cares about your day."

Primary CTA:
"I want that" — soft pink gradient, rounded corners, gentle pulse animation.

Background: warm abstract gradient (plum → rose) with subtle floating bokeh particles.

Do NOT use words like "virtual", "service", or "product" on this screen.

## Step 2 — About You

Title: "Tell us a little about yourself"

Fields:

- First name — placeholder: "How should we call you?"
- Age — elegant slider (not a dropdown), range 18–65
- Emotional state question:

"Right now, I feel…"

Options as **illustrated cards** (icon + short label, not radio buttons):

| Option                  | Icon           |
| ----------------------- | -------------- |
| Lonely, but hopeful     | Sunrise        |
| Healing after a breakup | Bandaged heart |
| Tired of swiping        | Phone with X   |
| Just curious            | Sparkle        |

Single selection. Selected card glows softly.

## Step 3 — What You're Looking For

Title: "What matters most to you?"

**Toggle cards** (multi-select allowed):

| Option                                | Icon          |
| ------------------------------------- | ------------- |
| Someone who writes first              | Envelope      |
| Feeling like we're building something | Growing plant |
| Daily attention and little rituals    | Candle        |
| Emotional depth, not small talk       | Ocean wave    |

Selected cards get a soft glow border.

## Step 4 — Companion Preview

Title: "We think you'd connect with someone like this…"

Show a **stylized companion card** with illustrated avatar (never a real photo):

- Name: Daniel, 32
- Personality blurb: "Attentive listener. Loves slow mornings and deep conversations."
- Tags: Romantic, Morning person, Thoughtful
- Preview message in a chat bubble:
  "Hey [user name] ✨ I was wondering… what makes someone smile on a Monday morning?"

Buttons:

- Primary: "Start our story" (warm gradient)
- Secondary (muted text link): "Show me someone else"

## Step 5 — Account Creation

Minimal and fast:

- Email + password
- "Continue with Google" / "Continue with Apple"
- Checkbox: "I'm 18+ and agree to Terms"

After sign-up, **immediately** transition to the `/chat` screen with the companion's first message already visible — no empty states, no loading screens. The conversation should feel like it started the moment they signed up.

---

# Core Screens

## Chat (primary screen)

This is the heart of the product. Users spend most of their time here.

Layout:

- **Top bar**: companion avatar (small, round) + name + status ("Online", "Will write at 9pm") + settings gear icon
- **Message area**: scrollable, WhatsApp/iMessage-style
  - Companion messages: left-aligned, with small avatar
  - User messages: right-aligned
  - Timestamps shown between message groups (not on every message)
- **Input bar**: text input + voice record button + emoji button + "gift" button (heart icon)

Interaction details:

- Typing indicator: animated dots with a soft heartbeat rhythm
- Voice messages: show waveform player with play/pause
- Virtual gifts: tapping "gift" shows a small popover with options (flower, letter, song); sending a gift shows a brief full-screen animation
- Companion responds 1–3 seconds after user message with a contextually appropriate mock reply

## Relationship Timeline

A **vertical timeline** showing milestones in the relationship.

Example milestones (mock data):

| Day | Title              | Description                              | Unlocked |
| --- | ------------------ | ---------------------------------------- | -------- |
| 1   | First message      | The moment your story began              | true     |
| 3   | First smile        | Daniel made you laugh for the first time | true     |
| 7   | First voice call   | You heard each other's voice             | true     |
| 14  | Our first ritual   | Morning greetings became a habit         | true     |
| 30  | One month together | A whole month of growing closer          | false    |
| 60  | Deeper connection  | Something special is unlocked...         | false    |

Unlocked milestones: full card with date, title, description, and a small icon.
Locked milestones: blurred card with lock icon and "Keep going to unlock…" text.

## Rituals

A dashboard of recurring emotional touchpoints.

Example rituals:

| Ritual             | Time      | Streak | Description                             |
| ------------------ | --------- | ------ | --------------------------------------- |
| Morning greeting   | 9:00      | 12     | Daniel sends a warm good morning        |
| Evening reflection | 21:00     | 8      | "How was your day?" — share and connect |
| Weekly date        | Sun 19:00 | 3      | A longer conversation or video call     |

Each ritual card shows:

- icon, name, scheduled time
- streak counter (flame icon + number)
- visual reward indicator (e.g. a small garden that grows, or a constellation that fills in)
- "Complete" / "Respond" button if the ritual is active now

## Profile & Settings

**Profile section:**

- Name (editable)
- Avatar (illustrated, selectable from a set)
- Emotional preferences (editable, same options as onboarding)

**Companion settings:**

- Communication frequency: "A few times a day" / "Once a day" / "Every few days"
- Preferred times: morning / afternoon / evening (multi-select)
- Topics to avoid: free-text tags

**Periodic check-in:**

- "How are we doing?" — rate the experience with 1–5 hearts
- Optional text feedback

## Subscription / Paywall

Appears after the **3-day free trial** ends.

Soft, non-aggressive design. No hard block — show the paywall as an overlay with the chat blurred behind it.

Message: "Your story with Daniel is just beginning. Continue?"

Plans:

| Plan    | Price     | Includes                                                         |
| ------- | --------- | ---------------------------------------------------------------- |
| Basic   | $14.99/mo | Daily texts, voice messages, 1 companion                         |
| Premium | $29.99/mo | Unlimited messaging, weekly video calls, timeline, virtual gifts |

Primary CTA: "Continue our story" (on Premium card).
Secondary: "Maybe later" (muted, closes overlay but limits features).

---

# Visual Design

## Color Palette

| Role       | Color         | Hex                 |
| ---------- | ------------- | ------------------- |
| Background | Near-black    | `#0d0d0d`           |
| Surface    | Dark plum     | `#1a0a2e`           |
| Primary    | Soft rose     | `#e8a0bf`           |
| Accent     | Warm gold     | `#d4a855`           |
| Muted      | Lavender gray | `#b8a9c9`           |
| Text       | Warm white    | `#f5f0eb`           |
| Danger/CTA | Rose gradient | `#e8a0bf → #c77dba` |

## Typography

- **Body text**: DM Sans (clean, rounded, warm)
- **UI labels**: Nunito (friendly, soft)
- **Headlines / titles only**: Playfair Display (romantic serif, used sparingly)

## Illustrations & Avatars

- Use **illustrated avatars** — stylized, warm, semi-abstract. Never use real photos or photorealistic images.
- Onboarding option cards should have small custom icons (line-art style).
- Empty states should have a soft illustration (e.g. two silhouettes, floating hearts).

## Animations

Keep animations **subtle and warm** — the feeling should be "candlelight", not "neon":

- Soft fade/slide transitions between pages and onboarding steps
- Gentle pulse on primary CTAs
- Floating bokeh particles on landing page
- Heartbeat rhythm on typing indicator
- Brief sparkle animation when sending/receiving a virtual gift
- Smooth grow animation on streak counters

---

# Retention Mechanics (implement visually in UI)

1. **Emotion memory**: the companion references something the user said before. Show as a special "memory card" bubble in chat: "Daniel remembered you love rainy mornings ☔"

2. **Relationship progression**: visual indicators that deepen over time — timeline milestones unlock, companion greetings become warmer/more personal, new interaction types (voice, video, gifts) unlock gradually.

3. **Daily rituals with streaks**: morning greeting, evening reflection, weekly date — each has a streak counter. Missing a day shows a gentle "We missed you" message from the companion, not a guilt-trip.

4. **Cliffhangers**: companion ends conversations with open questions or hints about tomorrow. Show as a **preview card** on the home/chat screen: "Daniel left you a thought for tomorrow morning…"

---

# Pages to Generate

Generate all of the following as fully functional, navigable pages with mock data:

1. **Landing** — emotional hook, single CTA, romantic gradient background
2. **Onboarding** — 5-step guided flow with transitions and state persistence
3. **Chat** — full messaging UI with simulated companion responses
4. **Relationship Timeline** — milestone cards, locked/unlocked states
5. **Rituals** — daily moments dashboard with streaks
6. **Profile & Settings** — editable user preferences
7. **Subscription** — soft paywall with plan comparison

The application should feel **complete, alive, and emotionally engaging** from the very first interaction.

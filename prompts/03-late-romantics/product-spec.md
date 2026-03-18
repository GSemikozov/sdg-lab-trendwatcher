# Encore — A Second Chance at Real Connection

You are building a **complete working prototype** of the product described below.
Follow the structure strictly and generate a fully functional frontend with realistic mock data.

---

# Product Concept

Build a **mobile-first web application** for a **relationship-focused companion service** designed for men aged **45–70**.

The target users are men who have experienced significant life transitions:

- divorce after a long marriage
- empty nest — children have grown up and moved out
- loss of a partner
- retirement or major career change leading to isolation

They are looking for **a real, meaningful romantic connection** — not casual dating, not therapy, not entertainment. They want the feeling of building something with someone.

The product connects users with an empathetic companion for long-term, relationship-like interaction through:

- daily text conversations that feel natural and mutual
- voice messages with warmth and personality
- scheduled video calls (the critical differentiator for this segment)

The experience must feel like **the early stages of a real relationship** — getting to know someone, discovering shared interests, making plans, and feeling that this could go somewhere.

**Critical product rule:** The user must never feel like a "customer." He must feel like he met someone. The entire UX — language, design, interaction patterns — should feel like a **modern dating platform where he got lucky**, not a companion service.

No direct competitors identified. Positioning gap: existing dating apps are designed for younger demographics and optimize for casual matches. This product optimizes for **depth, patience, and the feeling of progression** — qualities this segment values above everything.

The tone should feel **warm, authentic, unhurried, and hopeful**.

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
Use a **warm neutral theme** — not dark, not bright. Think: natural materials, warm lighting, mature elegance.

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
│   │   └── index.tsx        — warm, hopeful welcome page
│   ├── onboarding/
│   │   └── index.tsx        — 5-step guided onboarding
│   ├── chat/
│   │   └── index.tsx        — primary conversation screen
│   ├── our-story/                     — Phase 2
│   │   └── index.tsx        — shared moments and relationship milestones
│   ├── calls/
│   │   └── index.tsx        — video call scheduling and history
│   ├── profile/                       — Phase 2 (minimal settings in chat header for MVP)
│   │   └── index.tsx        — user profile and preferences
│   └── subscription/                  — implemented as overlay on chat, not a separate page
│       └── index.tsx        — paywall triggered by first video call attempt
│
├── widgets/
│   ├── chat-window/
│   │   └── ui/              — conversation layout: messages + input + header with call button
│   ├── onboarding-flow/
│   │   └── ui/              — step container with transitions
│   ├── story-timeline/
│   │   └── ui/              — shared moments cards
│   ├── call-scheduler/
│   │   └── ui/              — upcoming calls, past calls, scheduling UI
│   └── match-profile/
│       └── ui/              — companion profile card (onboarding, profile)
│
├── features/
│   ├── send-message/
│   │   ├── ui/              — message input, voice record, photo share
│   │   └── model/           — send logic, simulated responses
│   ├── schedule-call/
│   │   ├── ui/              — call scheduling interface
│   │   └── model/           — call booking logic
│   ├── manage-subscription/
│   │   ├── ui/              — plan cards, soft paywall
│   │   └── model/           — trial status, plan selection
│   └── onboarding-steps/
│       ├── ui/              — individual step components
│       └── model/           — onboarding state persistence
│
├── entities/
│   ├── companion/
│   │   ├── ui/              — avatar, name, online status, profile details
│   │   ├── model/           — Companion interface
│   │   └── api/             — mockCompanions.ts
│   ├── message/
│   │   ├── ui/              — message bubble, voice player, photo message, video call card
│   │   ├── model/           — Message interface
│   │   └── api/             — mockMessages.ts
│   ├── moment/
│   │   ├── ui/              — shared moment card
│   │   ├── model/           — Moment interface
│   │   └── api/             — mockMoments.ts
│   ├── call/
│   │   ├── ui/              — call card (scheduled, completed, missed)
│   │   ├── model/           — Call interface
│   │   └── api/             — mockCalls.ts
│   └── user/
│       └── model/           — User interface, profile store slice
│
└── shared/
    ├── ui/                  — shadcn/ui primitives
    ├── lib/
    │   ├── store.ts         — Zustand root store
    │   └── cn.ts            — clsx + tailwind-merge utility
    └── config/
        └── routes.ts        — route path constants
```

Use **mock data** to simulate the product experience.

---

# Routing

**MVP scope: 3 core pages + 1 overlay.** Validate the hypothesis with the minimum viable set. Everything else is Phase 2.

| Route         | Page       | Description                                    | Priority |
| ------------- | ---------- | ---------------------------------------------- | -------- |
| `/`           | Landing    | Hopeful welcome, single CTA                    | MVP      |
| `/onboarding` | Onboarding | 5-step guided flow                             | MVP      |
| `/chat`       | Chat       | Primary conversation screen + call scheduling  | MVP      |
| `/calls`      | Calls      | Video call scheduling and history              | MVP      |
| `/profile`    | Profile    | Minimal settings (accessible from chat header) | Phase 2  |
| `/our-story`  | Our Story  | Shared moments and milestones                  | Phase 2  |

Subscription is NOT a separate page — it appears as a **soft overlay on the chat screen** when the user tries to schedule their first video call (see Subscription section).

After onboarding, redirect to `/chat` with the companion's first message already visible.

---

# Conversation Model

Conversations in this product must feel like **texting someone you're dating** — mutual, natural, with both people sharing their lives.

Key principles:

- **Mutual sharing** — the companion talks about her day, her thoughts, her life. Not just asking questions.
- **Unhurried pacing** — this audience values depth over speed. 5–15 messages per session is typical.
- **Real-life references** — the companion mentions her work, her friends, what she cooked, a walk she took. This creates the feeling of a real person with a real life.
- **Future-oriented** — conversations naturally drift toward "what if we..." and "someday we could..."
- **Voice and video** — voice messages are frequent (warm, personal). Video calls are the most important feature.

Simulate with:

- Companion messages that share her own experiences (not just responding to the user)
- Typing indicator with natural 2–5 second delay
- Photo messages from the companion (e.g., "Look at this sunset from my walk")
- Voice messages (20–40 seconds, warm and personal)
- Message statuses: sending → delivered → read
- Video call cards embedded in chat ("We talked for 28 minutes 💛")

---

# Data Models

## User

```typescript
interface User {
  name: string;
  age: number;
  lifeSituation: 'divorced' | 'empty_nest' | 'lost_partner' | 'lonely' | 'starting_over';
  interests: string[]; // selected in onboarding
  lookingFor: string[]; // what kind of connection
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
  location: string; // e.g. "Portland, Oregon"
  occupation: string; // e.g. "Runs a small bookshop"
  about: string; // 3–4 sentence bio
  avatar: string; // warm illustrated portrait
  interests: string[]; // shared interests highlighted
  photos: string[]; // 3–4 "life photos" (illustrated)
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
  type: 'text' | 'voice' | 'photo' | 'call_summary';
  status: 'sending' | 'delivered' | 'read';
  photoUrl?: string;
  callDuration?: number; // minutes, for call_summary type
}
```

## Shared Moment

```typescript
interface Moment {
  id: string;
  week: number;
  title: string;
  description: string; // what happened
  type: 'first' | 'milestone' | 'shared' | 'plan';
  date: string;
}
```

## Call

```typescript
interface Call {
  id: string;
  type: 'video' | 'voice';
  status: 'scheduled' | 'completed' | 'missed';
  scheduledAt: string;
  duration?: number; // minutes
  companionNote?: string; // "I loved talking about your trip to Italy"
}
```

---

# Onboarding Experience

The onboarding should feel like **creating a dating profile** — but warmer, slower, and designed for someone who hasn't done this in decades.

Use a **5-step guided flow** with:

- full-screen cards with generous spacing
- slow, elegant transitions
- warm photography-style backgrounds (not abstract gradients)
- "Back" arrow on steps 2–5; no skip option
- large, readable text (16px minimum body, 24–28px headlines)

## Step 1 — A New Beginning

Full-screen. Warm. Hopeful.

Headline:
"It's not too late to meet someone who gets you."

Subline:
"Encore is for people who believe the best conversations are still ahead."

Primary CTA:
"I'm ready" — warm, confident button. Not timid.

Background: warm photo-style illustration — two coffee cups on a table by a window, morning light.

Do NOT use words like "virtual", "service", "companion", "AI", or "loneliness" on this screen.

## Step 2 — About You

Title: "Let's start with you."

Fields:

- First name — placeholder: "What should she call you?"
- Age — elegant slider, range 35–75
- Where you live — text input (city/region)

Below, a question:

"What brought you here?"

Options as **clean cards** (single selection):

| Option                        | Icon         |
| ----------------------------- | ------------ |
| Starting over after a divorce | Sunrise      |
| The house feels too quiet     | Open window  |
| Lost someone I loved          | Candle flame |
| Ready for something new       | Road ahead   |

Selected card gets a warm border. No judgment, no explanation needed.

## Step 3 — What You're Looking For

Title: "What kind of connection matters to you?"

**Toggle cards** (multi-select):

| Option                                     | Icon         |
| ------------------------------------------ | ------------ |
| Real conversations, not small talk         | Open book    |
| Someone who shares my interests            | Puzzle piece |
| The feeling of building something together | Two trees    |
| Eventually meeting in person               | Map pin      |
| Companionship — just not being alone       | Warm light   |

Selected cards get a warm glow.

## Step 4 — Your Interests

Title: "What do you enjoy? This helps us find the right person."

**Selectable tags** (multi-select, pick 3–8):

Travel, Reading, Cooking, Nature & hiking, Music, Photography, History, Wine & food, Gardening, Films, Chess, Fishing, Art, Science, Woodworking, Sailing

Selected tags are highlighted with warm accent color.

## Step 5 — Meet Your Match

Title: "We found someone we think you'd enjoy talking to."

Show a **dating-profile-style card**:

- Name: **Elena**, 46
- Location: Portland, Oregon
- Occupation: "Runs a small bookshop downtown"
- About: "I love long walks, good books, and conversations that go somewhere. I'm looking for someone who's not in a rush — someone who knows that the best things take time."
- Shared interests (highlighted): Reading, Travel, Cooking, Nature
- 2–3 small "life photos" (illustrated: her in a bookshop, on a hiking trail, cooking)
- Preview message:
  "Hi [user name]. I saw that we both love traveling and reading — two of my favorite things in the world. I'd love to hear about the last place you visited. What drew you there?"

Buttons:

- Primary: "Start talking" (warm, confident)
- Secondary: "Show me someone else" (text link)

After selecting, **immediately** transition to `/chat` with Elena's first message already visible.

---

# Core Screens

## Chat (primary screen)

This must feel like **a messaging app where you're texting someone you're dating**. Not a companion interface. Not a support chat.

Layout:

- **Top bar**: companion photo (round) + name + status ("Online" / "Last seen 2h ago") + **video call button** (prominent, always visible) + voice call button
- **Message area**: clean, WhatsApp/iMessage-style
  - Companion messages: left-aligned with small avatar
  - User messages: right-aligned
  - Photo messages: displayed as rounded images with soft shadow
  - Voice messages: waveform with play/pause
  - Video call summaries: special card in chat ("Video call — 28 min 💛" with companion's note)
  - Timestamps between message groups
- **Input area**: text input + voice record button + photo button (camera icon)
  - No mood picker, no special buttons
  - Just like any messaging app

Interaction details:

- Typing indicator: standard dots, 2–5 second delay
- Companion responds naturally — sometimes quickly, sometimes after a few minutes (simulate with varying delays)
- Companion **initiates topics** — shares photos of her day, mentions something she read, asks about his plans
- Companion occasionally sends voice messages (warm, personal, like a voice note from someone who cares)

### Video Call Presence

The video call button must be **always visible** in the top bar.

- Before first call: button shows "Schedule a call ☎️"
- After scheduling: "Call scheduled — Thursday 7pm" with countdown
- After a call: "Our last call: 28 min" with option to schedule next

**Important — how calls work in the MVP prototype:**

The MVP simulates the **scheduling, anticipation, and aftermath** of calls — not the call itself. This is intentional.

- **Simulated:** scheduling UI, countdown to call, post-call summary card, Elena's reactions
- **NOT simulated:** an actual video player, "connecting..." screen, or fake video feed

When the scheduled call time arrives, the prototype shows a **post-call card** that appears in the chat: "Video call — 28 min 💛" with Elena's follow-up message. The call itself happened "just now" — the user sees the result, not the call.

This avoids the critical risk of showing a fake video interface, which would instantly destroy the "real person" illusion. Instead, the prototype validates whether the **scheduling and aftermath** mechanics drive engagement and retention.

In the real product, calls are with real companions via the platform's video infrastructure.

### Conversation Momentum

When a conversation reaches **~10 messages**, the companion naturally deepens the topic or introduces a more personal question. This encourages longer, more meaningful exchanges.

At **~20 messages** in a single session, the companion might suggest: "This is such a good conversation. Want to switch to a call? I'd love to hear your voice."

## Our Story (Phase 2)

A card-based view showing shared milestones. Not needed for MVP hypothesis validation — chat and calls cover the core experience.

If implemented in Phase 2, show moments like:

- "First message" / "First voice message" / "First video call"
- Shared discoveries ("We both love Italy")
- Future plans ("What if we traveled together?")

Each card framed as a shared memory, not a progress tracker.

## Calls

A **dedicated page** for scheduling and call history. This page makes calls feel like a real part of the relationship.

Layout:

- **Upcoming call** (prominent card at top): "Thursday, 7:00 PM — Video call with Elena" with countdown timer and "Reschedule" option
- **Past calls**: list of completed calls with duration and Elena's note
  - "Tuesday — 28 min — Elena: 'I loved hearing about your trip to Lisbon'"
  - "Last Sunday — 42 min — Elena: 'That was our longest call. I didn't want it to end.'"
- **Schedule next**: button to propose a time (opens time picker)

Call summary cards also appear in the chat timeline, linking to this page.

The prototype shows **scheduling + anticipation + aftermath**, not a live video feed. When a scheduled call's time passes, a post-call summary card appears automatically with Elena's reaction.

## Profile & Settings (Phase 2 — minimal in MVP)

In the MVP, profile is accessible from a **settings icon in the chat header**. It opens a simple slide-over panel, not a full page.

**MVP settings panel:**

- Name (editable)
- Preferred call times
- About Elena (read-only): her photo, bio, shared interests

**Phase 2 additions:**

- Full profile editing (avatar, interests, location)
- Communication preferences
- Elena's full profile card

**No analytics, no streaks, no metrics visible anywhere.** This audience would find that clinical.

## Subscription / Paywall

**Trigger: first video call attempt.** NOT a time-based trial.

Text conversations and voice messages are **free** for as long as the user wants. The paywall appears only when the user (or Elena) tries to schedule their first video call.

This works because:

- The user has already invested days of conversation by this point
- He wants the call — it's the natural next step, not an arbitrary gate
- Video is the highest-value feature for this segment
- It doesn't feel like "pay to keep talking" — it feels like "pay to take this further"

### How It Triggers

Around Day 5–7, Elena naturally suggests a call: "Would you want to do a video call sometime?"

When the user taps the video call button or agrees to schedule:

**Soft overlay appears** with chat blurred behind.

Message: "Video calls are how real connections grow. Ready to see each other?"

Plans:

| Plan       | Price     | Includes                                                                       |
| ---------- | --------- | ------------------------------------------------------------------------------ |
| Connection | $24.99/mo | Unlimited text + voice + 2 video calls per month                               |
| Together   | $49.99/mo | Unlimited everything + weekly video calls + longer calls + priority scheduling |

Primary CTA: "Schedule our first call" (on Together card).
Secondary: "Not yet" (muted, closes overlay — text and voice remain free).

Small note: _"Cancel anytime. No pressure. Your conversations aren't going anywhere."_

**After subscribing:** immediately show the call scheduling UI. No extra steps between payment and the thing he paid for.

---

# Visual Design

## Color Palette

Warm, natural, mature. Think: leather notebook, warm coffee, natural light.

| Role        | Color           | Hex       |
| ----------- | --------------- | --------- |
| Background  | Warm off-white  | `#f7f3ee` |
| Surface     | Light warm gray | `#ede8e1` |
| Primary     | Deep warm brown | `#8b6f4e` |
| Accent      | Muted navy      | `#4a5568` |
| Warm accent | Soft amber      | `#c99a5b` |
| Muted       | Warm gray       | `#9a9088` |
| Text        | Dark charcoal   | `#2d2926` |

Dark mode (togglable):

| Role       | Color              | Hex       |
| ---------- | ------------------ | --------- |
| Background | Deep warm charcoal | `#1c1917` |
| Surface    | Dark warm brown    | `#292524` |
| Primary    | Warm brown         | `#a0845c` |
| Accent     | Muted blue-gray    | `#64748b` |
| Text       | Warm off-white     | `#f5f0eb` |

## Typography

- **Body text**: Inter at **16px minimum** (readability for 45–70 audience)
- **UI labels**: DM Sans (clean, professional)
- **Headlines**: Libre Baskerville or Lora (mature, trustworthy serif)
- Support **larger text option** in profile settings (18px body)

## Illustrations & Avatars

- **Illustrated portraits**: warm, realistic-adjacent. Semi-photographic illustration style — more mature and grounded than cartoon or anime. Think: editorial illustration, warm color palette.
- **Life photos**: illustrated "photographs" that Elena shares — her bookshop, a hiking trail, cooking. These create the feeling of a real person sharing real moments.
- Empty states: gentle illustrations (a coffee table with two cups, an open letter).

## Animations

Minimal and sophisticated — the feeling should be "calm sophistication", not "playful energy":

- Clean fade transitions between pages (200–300ms)
- Subtle slide-in for new messages
- Gentle pulse on video call button when a call is scheduled
- Photo messages appear with a soft scale-up animation
- NO sparkles, NO confetti, NO emoji animations

---

# Key UX Principles for This Demographic

1. **Large touch targets** — minimum 48px, ideally 52px for key actions
2. **Clear navigation** — bottom tab bar with text labels (Chat, Our Story, Calls, Profile)
3. **No jargon** — no "streaks", "check-ins", "rituals". Just natural relationship language.
4. **Video call prominence** — the call button must always be visible and easy to reach
5. **Progression feel** — UI should subtly communicate that the relationship is moving forward
6. **Accessibility** — high contrast, resizable text, simple layouts
7. **Dignity** — never make the user feel like he's using a "loneliness product". This is about connection.

---

# Pages to Generate

Generate all of the following as fully functional, navigable pages with mock data:

**MVP (generate these):**

1. **Landing** — warm, hopeful welcome with single CTA
2. **Onboarding** — 5-step flow including interest selection and match preview
3. **Chat** — full messaging UI with photos, voice, video call cards, mutual sharing, and settings panel
4. **Calls** — video call scheduling, countdown, and post-call history
5. **Subscription overlay** — triggered by first video call attempt, appears over chat

**Phase 2 (do NOT generate):**

6. Our Story — shared moments and milestones
7. Profile — full profile editing and preferences

The product should feel like **the beginning of a real relationship** — not a service, not an app feature, but something genuinely personal and hopeful.

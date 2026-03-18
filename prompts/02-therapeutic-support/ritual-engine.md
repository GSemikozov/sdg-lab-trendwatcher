# Ritual Engine — Therapeutic Support

This prompt defines the daily support rituals and retention mechanics. Rituals are framed as **gentle daily touchpoints**, not habits or streaks to grind.

For this audience, rituals validate two things:

1. **Someone shows up for me every day** (addresses loneliness)
2. **I have a reason to come back** (drives the key metric: return next day)

---

# Check-In Types

| Check-In          | Frequency       | Time   | Tone                    | Purpose                                  |
| ----------------- | --------------- | ------ | ----------------------- | ---------------------------------------- |
| Morning Presence  | Daily           | ~09:00 | Gentle, present         | "Someone thought of you this morning"    |
| Evening Wind-Down | Daily           | ~21:00 | Reflective, quiet       | End the day feeling less alone           |
| Weekly Deep Talk  | Weekly (Sunday) | ~18:00 | Philosophical, intimate | The deepest conversation of the week     |
| Reflection Moment | 2–3x per week   | Random | Warm, memory-driven     | Marina brings up something from the past |

---

# Check-In Data Model

```typescript
interface CheckIn {
  id: string;
  type: 'morning' | 'evening' | 'weekly_deep' | 'reflection';
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'custom';
  scheduledTime: string;
  scheduledDay?: string;
  streak: number;
  longestStreak: number;
  lastCompletedAt: string | null;
  isActive: boolean;
  companionMessage: string;
}
```

---

# Mock Check-In Data

```typescript
const mockCheckIns: CheckIn[] = [
  {
    id: 'checkin-morning',
    type: 'morning',
    title: 'Morning Presence',
    description: 'Marina checks in to start the day with you',
    frequency: 'daily',
    scheduledTime: '09:00',
    streak: 14,
    longestStreak: 14,
    lastCompletedAt: '2026-02-25T09:08:00Z',
    isActive: false,
    companionMessage: "Good morning. No big questions today. I just wanted you to know I'm here.",
  },
  {
    id: 'checkin-evening',
    type: 'evening',
    title: 'Evening Wind-Down',
    description: 'Reflect on the day before it ends',
    frequency: 'daily',
    scheduledTime: '21:00',
    streak: 10,
    longestStreak: 14,
    lastCompletedAt: '2026-02-24T21:15:00Z',
    isActive: true,
    companionMessage: 'The day is ending. Was there a moment — even a quiet one — that felt okay?',
  },
  {
    id: 'checkin-weekly',
    type: 'weekly_deep',
    title: 'Sunday Conversation',
    description: 'A longer, deeper talk — Marina prepares a topic',
    frequency: 'weekly',
    scheduledTime: '18:00',
    scheduledDay: 'sunday',
    streak: 4,
    longestStreak: 4,
    lastCompletedAt: '2026-02-23T18:30:00Z',
    isActive: false,
    companionMessage:
      "It's Sunday. I've been thinking about something all week — can I share it with you?",
  },
  {
    id: 'checkin-reflection',
    type: 'reflection',
    title: 'Reflection Moment',
    description: 'Marina brings up something meaningful from this week',
    frequency: 'custom',
    scheduledTime: '15:00',
    streak: 0,
    longestStreak: 0,
    lastCompletedAt: null,
    isActive: false,
    companionMessage: 'Something you said earlier this week stayed with me. Can we talk about it?',
  },
];
```

---

# Streak Design (Gentle, Not Gamified)

This audience should NOT feel pressured by streaks. The streak mechanic is **visible but not punishing**.

## Visual Treatment

- Use a **quiet counter** with a 🌿 leaf icon — NOT fire/flame (too aggressive)
- Growing visual metaphor: **a small plant** that develops over time
  - Days 1–3: seed in soil
  - Days 4–7: sprout
  - Days 8–14: small plant with leaves
  - Days 15–30: flowering plant
  - Days 30+: small garden
- The visual is about **growth**, not about not-breaking-a-chain

## Streak Rewards

| Streak  | What Happens                                                                   |
| ------- | ------------------------------------------------------------------------------ |
| 3 days  | Small note from Marina: "Three days in a row. You're showing up for yourself." |
| 7 days  | "Our first week" badge 🌿 — Journal entry unlocks for Week 1                   |
| 14 days | "Two weeks" — Marina sends a longer voice message reflecting on the journey    |
| 30 days | "One month together" — special journal entry + Marina's letter                 |

## Missing a Day

Marina's response to a missed check-in is **warm, not guilting**:

| Scenario                      | Marina's Message                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Missed morning (by noon)      | "Quiet morning? That's okay. I'll be here whenever you're ready."                                          |
| Missed evening (next morning) | "I noticed you didn't check in last night. I hope you rested well. No catch-up needed 🌿"                  |
| Missed 2+ days                | "It's been a couple of days. No pressure. Sometimes stepping back is part of the process. I'm still here." |
| Missed weekly deep talk       | "We missed our Sunday conversation. Want to have a shorter version today, or save it for next week?"       |

**Rule:** Maximum 1 follow-up per missed check-in. Never use guilt language. Never track "days missed" visually.

---

# Weekly Deep Talk (Sunday Conversation)

The most important retention mechanism. This is the conversation the user looks forward to all week.

Marina **prepares a topic** in advance — it's not a random check-in.

Example Sunday topics (mock data):

| Week | Topic Marina Prepares                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | "I'd like to understand what your life looked like a year ago. Not the events — the feeling of it."                                               |
| 2    | "Let's talk about the word 'enough.' You've used it a few times — 'not good enough,' 'not doing enough.' Where does that come from?"              |
| 3    | "I want to ask you something I've been wondering: what are you afraid of, right now? Not the big existential thing. The specific, everyday fear." |
| 4    | "You've been here a month. I want to tell you what I've noticed changing, and then I want you to tell me what you feel has changed."              |

The Sunday conversation is typically the longest session of the week (20–30 messages).

---

# Forward References (Return Triggers)

Marina plants seeds for future conversations — reasons to come back tomorrow:

- "I want to come back to something you said. Let it sit overnight. We'll talk in the morning."
- "I have something I'd like to share with you on Sunday. I'm still thinking about how to say it."
- "Before we finish — there's a question I want to ask you. But not today. Tomorrow."

In the UI, after the conversation ends:

> 🌿 _"Marina will be here tomorrow morning."_

This is NOT a cliffhanger in the romantic sense — it's a **promise of continuity**. The message conveys: someone is coming back. You are not alone.

---

# Check-In UI on Conversation Screen

When a check-in is active (within its scheduled window):

- Show a **warm, subtle banner** at the top of the conversation screen:
  "☀️ Morning presence is ready" or "🌙 Evening wind-down"
- Tapping the banner scrolls to Marina's check-in message
- After the user responds, the banner fades gently and the streak updates with a slow animation
- If the user doesn't engage within the window, the banner dims to: _"Missed — that's okay. Marina left you a note."_

---

# Minimal Companion Presence in Profile

In the Profile page, show a **small, warm section** — not analytics, not a dashboard. Just a few human-feeling numbers.

Title: **"You and Marina"** (not "Your Journey", not "Insights")

```
You and Marina
──────────────────────────

┌──────────────┐  ┌──────────────┐
│   18 days    │  │  ~12 hours   │
│  talking     │  │  of real     │
│  together    │  │  conversation│
└──────────────┘  └──────────────┘
```

Only two numbers:

- **Days together** — simple counter, warm
- **Hours of conversation** — estimated from message count, positioned as "look how much we've talked" not "look at your metrics"

No percentages. No completion rates. No streak numbers in the profile. Streaks live on the check-in cards only.

## Internal Analytics (for founders, NOT shown to user)

Track these signals internally in the data model to validate hypotheses. They do NOT appear in the UI — they're for your product team to analyze.

```typescript
interface InternalAnalytics {
  daysTogether: number;
  conversationStreak: number; // consecutive days with ≥1 exchange
  longestConversationStreak: number;
  averageMessagesPerSession: number;
  totalCheckInsCompleted: number;
  checkInCompletionRate: number; // 0–1
  lastActiveAt: string;
}
```

Validation criteria:

- **Return next day** → `conversationStreak` (target: >7 days)
- **Conversation length** → `averageMessagesPerSession` (target: >15 messages)
- **Ritual adoption** → `checkInCompletionRate` (target: >70%)

If `conversationStreak` is high and `averageMessagesPerSession` is >15, the hypothesis is validated — this audience will engage deeply with an empathetic companion.

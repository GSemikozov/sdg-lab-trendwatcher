# Ritual Engine

This prompt defines the daily ritual system — recurring emotional touchpoints that create **habit loops** and drive daily return visits.

Rituals are the core retention mechanic. They validate hypothesis #3 (daily rituals drive engagement) and directly impact the key metric: **return next day**.

---

# Ritual Types

| Ritual             | Frequency       | Time   | Purpose                                                          |
| ------------------ | --------------- | ------ | ---------------------------------------------------------------- |
| Morning Greeting   | Daily           | ~09:00 | Start the day connected. Companion writes first.                 |
| Evening Reflection | Daily           | ~21:00 | End the day with emotional check-in.                             |
| Weekly Date        | Weekly (Sunday) | ~19:00 | Longer, deeper conversation or shared activity.                  |
| Memory Moment      | 2–3x per week   | Random | Companion references a stored memory (bridges to memory system). |

---

# Ritual Data Model

```typescript
interface Ritual {
  id: string;
  type: 'morning' | 'evening' | 'weekly_date' | 'memory_moment';
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'custom';
  scheduledTime: string; // e.g. "09:00"
  scheduledDay?: string; // e.g. "sunday" (for weekly only)
  streak: number;
  longestStreak: number;
  lastCompletedAt: string | null;
  isActive: boolean; // is this ritual currently "live" / awaiting response?
  companionMessage: string; // what the companion says to initiate this ritual
}
```

---

# Mock Ritual Data

```typescript
const mockRituals: Ritual[] = [
  {
    id: 'ritual-morning',
    type: 'morning',
    title: 'Morning Greeting',
    description: 'Daniel sends you a warm start to the day',
    frequency: 'daily',
    scheduledTime: '09:00',
    streak: 12,
    longestStreak: 12,
    lastCompletedAt: '2026-02-25T09:14:00Z',
    isActive: false,
    companionMessage: "Morning ✨ What's the first thing on your mind today?",
  },
  {
    id: 'ritual-evening',
    type: 'evening',
    title: 'Evening Reflection',
    description: 'Share how your day went — the good and the hard parts',
    frequency: 'daily',
    scheduledTime: '21:00',
    streak: 8,
    longestStreak: 11,
    lastCompletedAt: '2026-02-24T21:22:00Z',
    isActive: true,
    companionMessage: 'Hey. Before the day is over — tell me one thing that stayed with you.',
  },
  {
    id: 'ritual-weekly',
    type: 'weekly_date',
    title: 'Sunday Date',
    description: 'A longer conversation, just the two of you',
    frequency: 'weekly',
    scheduledTime: '19:00',
    scheduledDay: 'sunday',
    streak: 3,
    longestStreak: 3,
    lastCompletedAt: '2026-02-23T19:45:00Z',
    isActive: false,
    companionMessage: "It's our Sunday. I have something I wanted to ask you...",
  },
  {
    id: 'ritual-memory',
    type: 'memory_moment',
    title: 'Memory Moment',
    description: 'Daniel brings up something you shared before',
    frequency: 'custom',
    scheduledTime: '14:00',
    streak: 0,
    longestStreak: 0,
    lastCompletedAt: null,
    isActive: false,
    companionMessage: 'Remember when you told me about rainy mornings? I thought of you today ☁️',
  },
];
```

---

# Streak Mechanics

Streaks are the primary visual retention driver.

## How Streaks Work

- User "completes" a ritual by **responding** to the companion's ritual message
- Streak increments if completed within the expected window (± 3 hours from scheduled time)
- Missing a day resets the streak (but longest streak is preserved)

## Streak Rewards (visual, not gated content)

| Streak  | Reward                                                                  |
| ------- | ----------------------------------------------------------------------- |
| 3 days  | Small badge: "Getting closer" 🌱                                        |
| 7 days  | Badge upgrade: "Our first week" 🌿 + new companion greeting variant     |
| 14 days | Badge: "Building something real" 🌳 + unlock a timeline milestone       |
| 30 days | Badge: "One month together" 💫 + companion sends a special long message |

## Visual Streak Indicator

On the Rituals page, each ritual card shows:

- 🔥 flame icon + streak number
- A small **growing visual** that progresses with streak length:
  - Days 1–3: seed
  - Days 4–7: sprout
  - Days 8–14: small plant
  - Days 15–30: blooming flower
  - Days 30+: full garden

This creates a tangible sense of "we're building something."

---

# Missed Ritual Behavior

If the user misses a ritual, the companion sends a **gentle** follow-up — never guilt:

| Missed                           | Companion Message                                            |
| -------------------------------- | ------------------------------------------------------------ |
| Morning (missed by noon)         | "Hey, quiet morning? No worries. I'm here whenever you are." |
| Evening (missed by next morning) | "You didn't check in last night. Hope you're okay 💛"        |
| Weekly date (missed by Monday)   | "We missed our Sunday thing. Want to make up for it today?"  |

**Rule:** Never more than 1 follow-up per missed ritual. Never use words like "disappointed" or "you forgot."

---

# Ritual UI on Chat Screen

When a ritual is active (within its scheduled window):

- Show a **soft banner** at the top of the chat: "🕯️ Evening Reflection is ready"
- Tapping the banner scrolls to the companion's ritual message
- After the user responds, the banner disappears and the streak updates with a brief animation

---

# Cliffhangers (from engagement-engine, integrated here)

Cliffhangers are NOT a separate ritual — they are how the **last message of the day** works.

After the evening ritual (or the last conversation of the day), the companion ends with:

- "I want to tell you something in the morning. Don't let me forget."
- "I've been thinking about a question... I'll ask you tomorrow ✨"
- "Sleep well. I'll be here first thing."

In the UI, show a **preview card** on the chat screen after the conversation ends:

> 💬 _"Daniel left you a thought for tomorrow morning…"_

This card disappears when the morning message arrives — replaced by the actual message.

---

# Analytics Tracking (Key MVP Metrics)

Track these signals to validate hypotheses. In the prototype, show a minimal **"Insights" section** in the Profile page (visible only to the user — positioned as "Your Relationship Stats"):

## Metrics to Display

| Metric                          | What it shows                             | Why it matters                |
| ------------------------------- | ----------------------------------------- | ----------------------------- |
| **Days together**               | Counter since Day 1                       | Relationship progression feel |
| **Conversation streak**         | Consecutive days with ≥1 message exchange | Validates return next day     |
| **Average conversation length** | Messages per session                      | Validates depth of engagement |
| **Rituals completed**           | Total + completion rate %                 | Validates habit loop          |
| **Longest streak**              | Per ritual                                | Shows commitment peak         |

## UI for Insights

Simple card grid on the Profile page:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  18 days     │  │  12 day      │  │  ~8 msgs     │
│  together    │  │  streak 🔥   │  │  per session  │
└──────────────┘  └──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐
│  87%         │  │  14 days     │
│  rituals     │  │  longest 🌿  │
└──────────────┘  └──────────────┘
```

These metrics serve double duty:

1. **For the user**: creates a sense of investment ("look how far we've come")
2. **For the founders**: validates or invalidates the core hypotheses without external analytics tools

## Data Model for Analytics

```typescript
interface RelationshipStats {
  daysTogether: number;
  conversationStreak: number; // consecutive days with ≥1 exchange
  longestConversationStreak: number;
  averageMessagesPerSession: number;
  totalRitualsCompleted: number;
  ritualCompletionRate: number; // 0–1
  longestRitualStreak: number;
  lastActiveAt: string;
}
```

Pre-populate with mock data that tells a compelling story (18 days, 12-day streak, 87% ritual completion).

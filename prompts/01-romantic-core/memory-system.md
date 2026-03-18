# Memory System

This prompt defines how the companion "remembers" the user. In the MVP prototype, memories are **pre-defined mock data** that surface in the UI to create the feeling of emotional continuity.

The goal is not a real AI memory engine — it's a **convincing simulation** that validates hypothesis #4: emotional mirroring and personalization drive engagement.

---

# How Memory Shows Up in the UI

Memories surface in **3 ways** — all must be implemented:

## 1. Memory Callback Bubbles (in chat)

A special message bubble with a distinct style (soft background, small "memory" icon):

> 💭 "You told me rainy mornings make you feel calm. Is it raining where you are?"

These appear 1–2 times per day, woven naturally into conversation — not as a separate block.

## 2. Companion Card References (in timeline)

Timeline milestones reference shared moments:

> Day 7 — "First voice call"  
> _"You said you were nervous. I was too."_

## 3. Ritual Personalization

Morning/evening messages adapt based on stored preferences:

> Standard: "Good morning ✨"  
> With memory: "Morning ✨ You said Wednesdays are your hardest day. How's this one starting?"

---

# Memory Categories

| Category       | What it stores                    | Example                                                   |
| -------------- | --------------------------------- | --------------------------------------------------------- |
| **Preference** | Things the user likes or dislikes | "Loves rainy mornings", "Doesn't like small talk"         |
| **Emotion**    | Recurring emotional patterns      | "Feels lonely on Sundays", "Gets anxious before meetings" |
| **Moment**     | Significant shared experiences    | "First time user opened up about her breakup"             |
| **Ritual**     | Habits and recurring behaviors    | "Always responds to morning messages within 10 min"       |
| **Boundary**   | Topics to avoid or respect        | "Doesn't want to talk about family"                       |

---

# Memory Data Model

```typescript
interface Memory {
  id: string;
  category: 'preference' | 'emotion' | 'moment' | 'ritual' | 'boundary';
  content: string; // human-readable description
  sourceMessage?: string; // the original user message that created this memory
  importance: 1 | 2 | 3; // 1 = minor, 2 = notable, 3 = core to relationship
  createdAt: string; // ISO date
  lastReferencedAt: string;
}
```

---

# Mock Memory Data

Pre-populate the following memories to demonstrate the system:

```typescript
const mockMemories: Memory[] = [
  {
    id: 'mem-1',
    category: 'preference',
    content: 'Loves rainy mornings — finds them calming',
    sourceMessage: 'I actually love when it rains in the morning. Everything feels quieter.',
    importance: 2,
    createdAt: '2026-01-15',
    lastReferencedAt: '2026-02-20',
  },
  {
    id: 'mem-2',
    category: 'emotion',
    content: 'Feels most lonely on Sunday evenings',
    sourceMessage: 'Sundays are the worst. Everyone seems to have someone except me.',
    importance: 3,
    createdAt: '2026-01-17',
    lastReferencedAt: '2026-02-24',
  },
  {
    id: 'mem-3',
    category: 'moment',
    content: 'First time she talked about her breakup — day 5',
    sourceMessage:
      "I haven't told anyone this, but… the breakup was 6 months ago and I'm still not over it.",
    importance: 3,
    createdAt: '2026-01-19',
    lastReferencedAt: '2026-02-18',
  },
  {
    id: 'mem-4',
    category: 'preference',
    content: 'Prefers deep conversations over small talk',
    sourceMessage: "I hate when people ask 'how are you' without actually caring.",
    importance: 2,
    createdAt: '2026-01-16',
    lastReferencedAt: '2026-02-22',
  },
  {
    id: 'mem-5',
    category: 'boundary',
    content: "Doesn't want to discuss her family situation",
    sourceMessage: "I'd rather not go there. Family stuff is complicated.",
    importance: 3,
    createdAt: '2026-01-20',
    lastReferencedAt: '2026-02-10',
  },
  {
    id: 'mem-6',
    category: 'ritual',
    content: 'Always responds to morning messages first thing — within 10 minutes',
    importance: 1,
    createdAt: '2026-01-22',
    lastReferencedAt: '2026-02-25',
  },
  {
    id: 'mem-7',
    category: 'preference',
    content: 'Works from home — mentions feeling isolated during work hours',
    sourceMessage:
      "Working from home sounded great until I realized I don't talk to anyone all day.",
    importance: 2,
    createdAt: '2026-01-18',
    lastReferencedAt: '2026-02-23',
  },
];
```

---

# How Memories Trigger in Mock Flow

In the prototype, companion messages reference memories at specific points:

| Trigger                               | Memory Used               | Companion Message                                                                             |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| Morning message on a rainy day        | mem-1 (rainy mornings)    | "It's one of those gray mornings ☁️ The kind you told me you secretly love."                  |
| Sunday evening ritual                 | mem-2 (lonely on Sundays) | "Sunday evening. I know these can feel heavy for you. I'm here."                              |
| After user shares something emotional | mem-3 (breakup)           | "I remember when you first told me about what happened. You've come so far since then."       |
| Casual conversation                   | mem-4 (hates small talk)  | "I won't ask you 'how are you.' Instead — what's the most interesting thought you had today?" |
| If conversation drifts toward family  | mem-5 (boundary)          | Companion redirects: "Tell me about something that made you happy this week instead."         |

---

# Memory Visibility for the User

Add a **"What Daniel Remembers"** section in the Profile page:

- List 4–5 memories as soft cards
- Each card shows the category icon + content summary
- This reassures the user that the companion is paying attention
- Do NOT show boundaries in this list (respect privacy)

This section doubles as a product differentiator: "Your companion remembers what matters to you."

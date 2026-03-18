# Memory System — Therapeutic Support

This prompt defines how the companion "remembers" the user in the therapeutic support product. In the MVP, memories are **pre-defined mock data** that surface in conversation and UI to create the feeling that someone truly knows you and has been paying attention.

For this audience, memory is not a nice-to-have — it's the core value proposition. The feeling of being **known and remembered** directly addresses their deepest pain: the fear of being invisible and alone.

---

# How Memory Shows Up in the UI

Memories surface in **4 ways**:

## 1. Woven Into Conversation (primary)

Marina naturally references past conversations. These are NOT special UI elements — they're regular messages that happen to contain remembered details:

> "Last Tuesday you told me the hardest part of Sunday evenings is the quiet after the kids leave. Is it the same today?"

> "You said something a few days ago that I keep coming back to — that you feel like you're 'performing okay.' I wonder who that performance is for."

In mock data, include 3–5 memory references scattered through the conversation history.

## 2. Memory Callback Bubbles (distinct UI treatment)

Occasional special message with a subtle visual distinction (slightly different background, small 🌿 icon):

> 🌿 "Remember when you told me you used to love cooking, but it lost its meaning when there was no one to cook for? I've been thinking about that."

These appear **once per day maximum** — overusing them breaks the naturalistic feel.

## 3. Weekly Reflection Cards

Each weekly reflection card references specific things the user said:

> Week 3 — Marina's note:
> _"You laughed today. You probably didn't notice, but I did. And you mentioned that you tried cooking again — pasta, nothing special, you said. But it is special."_

## 4. "What Marina Remembers" (in Profile)

A warm section in the Profile page showing what the companion has learned:

- Displayed as soft cards with category icon + content
- Framed as: **"Things I've noticed about you"** (Marina's voice, not system language)
- Do NOT show boundaries in this list
- Maximum 6–8 items visible

---

# Memory Categories

| Category        | What It Stores                                             | Why It Matters                                       |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| **Life story**  | Key life events, relationships, context                    | Marina understands the whole picture, not just today |
| **Pain points** | Recurring sources of sadness, anxiety, frustration         | Marina doesn't accidentally reopen wounds            |
| **Strengths**   | Moments of resilience the user may not see                 | Marina reflects the user's own strength back to them |
| **Preferences** | What the user enjoys, values, finds comforting             | Personalizes daily interactions                      |
| **Patterns**    | Recurring emotional cycles (bad Sundays, anxious mornings) | Marina can preemptively check in                     |
| **Boundaries**  | Topics to avoid, things that trigger distress              | Marina respects limits without needing reminders     |

---

# Memory Data Model

```typescript
interface Memory {
  id: string;
  category: 'life_story' | 'pain_point' | 'strength' | 'preference' | 'pattern' | 'boundary';
  content: string;
  sourceQuote?: string; // the user's original words
  importance: 1 | 2 | 3; // 1 = minor, 2 = notable, 3 = core to who they are
  weekDiscovered: number; // which week of the relationship
  lastReferencedAt: string;
}
```

---

# Mock Memory Data

```typescript
const mockMemories: Memory[] = [
  {
    id: 'mem-1',
    category: 'life_story',
    content: 'Going through a divorce after 18 years of marriage',
    sourceQuote: "Eighteen years. And now I'm signing papers like it's a business deal.",
    importance: 3,
    weekDiscovered: 1,
    lastReferencedAt: '2026-02-22',
  },
  {
    id: 'mem-2',
    category: 'pain_point',
    content: 'Sunday evenings are the hardest — kids go back to their father',
    sourceQuote: 'Sunday nights are the worst. The apartment gets so quiet after they leave.',
    importance: 3,
    weekDiscovered: 1,
    lastReferencedAt: '2026-02-23',
  },
  {
    id: 'mem-3',
    category: 'pain_point',
    content: 'Feels like a burden to her adult daughter',
    sourceQuote:
      "I called her twice this week. I could hear the impatience in her voice. I don't want to be that mother.",
    importance: 3,
    weekDiscovered: 2,
    lastReferencedAt: '2026-02-20',
  },
  {
    id: 'mem-4',
    category: 'strength',
    content: 'Started cooking again after months of not caring',
    sourceQuote: 'I made pasta last night. Nothing special. But I actually wanted to eat it.',
    importance: 2,
    weekDiscovered: 3,
    lastReferencedAt: '2026-02-24',
  },
  {
    id: 'mem-5',
    category: 'preference',
    content: 'Loves autumn — associates it with feeling grounded',
    sourceQuote:
      "There's something about October. The cold air, the color of the trees. I feel more myself.",
    importance: 1,
    weekDiscovered: 2,
    lastReferencedAt: '2026-02-18',
  },
  {
    id: 'mem-6',
    category: 'pattern',
    content: 'Anxiety peaks on Monday mornings — worries about the week ahead',
    sourceQuote:
      'Monday is when it all crashes. Everything I managed to ignore over the weekend comes back.',
    importance: 2,
    weekDiscovered: 2,
    lastReferencedAt: '2026-02-24',
  },
  {
    id: 'mem-7',
    category: 'strength',
    content: 'Used to love reading — wants to start again',
    sourceQuote:
      "I used to read a book a week. I haven't touched one in months. Maybe I should try.",
    importance: 1,
    weekDiscovered: 3,
    lastReferencedAt: '2026-02-21',
  },
  {
    id: 'mem-8',
    category: 'boundary',
    content: "Does not want to discuss her ex-husband's new relationship",
    sourceQuote: "I don't want to hear about her. I know she exists. That's enough.",
    importance: 3,
    weekDiscovered: 1,
    lastReferencedAt: '2026-02-15',
  },
  {
    id: 'mem-9',
    category: 'life_story',
    content: 'Works as a librarian — finds it calming but isolating',
    sourceQuote:
      "I'm surrounded by books and silence all day. I used to love it. Now it just reminds me that no one talks to me.",
    importance: 2,
    weekDiscovered: 1,
    lastReferencedAt: '2026-02-22',
  },
  {
    id: 'mem-10',
    category: 'pattern',
    content: 'Responds best in the evenings — mornings are harder to articulate feelings',
    importance: 1,
    weekDiscovered: 2,
    lastReferencedAt: '2026-02-25',
  },
];
```

---

# How Memories Trigger in Mock Flow

| Trigger                                     | Memory Used                    | Marina's Message                                                                                                                             |
| ------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Monday morning check-in                     | mem-6 (anxiety on Mondays)     | "Monday again. I know these mornings can feel like a wall. What's the loudest thought right now?"                                            |
| Sunday evening check-in                     | mem-2 (quiet after kids leave) | "Sunday evening. The quiet after they leave — I know. You don't have to fill it with words. But I'm here if you want to."                    |
| User mentions calling her daughter          | mem-3 (fear of being a burden) | "You called her? That takes courage, especially with how you've been feeling about it. How did it go?"                                       |
| Mid-week conversation                       | mem-4 (started cooking)        | "Did you cook anything this week? The pasta story stayed with me. Something small like that can mean a lot."                                 |
| Random reflection moment                    | mem-7 (reading)                | "You mentioned you used to read a lot. Have you picked anything up? If not, no pressure — but I'd love to hear what you'd choose."           |
| Conversation drifts toward ex's new partner | mem-8 (boundary)               | Marina gently redirects: "Let's stay with how you're feeling, not the details of what's happening on that side. What do you need right now?" |
| Autumn season                               | mem-5 (loves autumn)           | "It's getting colder. You told me something about autumn — how it makes you feel more like yourself. Is that happening?"                     |

---

# Memory Density Guidelines

- **Week 1**: 1–2 memory references (Marina is still learning)
- **Week 2–3**: 3–4 references per week (the user starts feeling known)
- **Week 4+**: daily memory references woven naturally into conversation

This progression is critical — too many memories too early feels surveillance-like. Too few in later weeks feels like Marina stopped caring.

---

# "What Marina Remembers" — Profile Section

Display in the Profile page as a warm, non-clinical view.

Title: **"Things I've noticed about you"** (written in Marina's voice)

Show as soft cards:

```
┌─────────────────────────────────────────────────┐
│ 🍂  "You feel most like yourself in autumn."    │
│     Noticed in week 2                           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ 📖  "You used to read a book a week."           │
│     Noticed in week 3                           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ 🍝  "You started cooking again."                │
│     Noticed in week 3                           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ 💪  "Monday mornings are your hardest."         │
│     Noticed in week 2                           │
└─────────────────────────────────────────────────┘
```

Rules:

- Show **preferences, strengths, and patterns** — never boundaries or pain points
- Maximum 6–8 items
- Each card has a warm icon and a short phrase in Marina's voice
- This section makes the user feel seen — it's a retention feature

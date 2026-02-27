import type { Report, Signal, SignalStrength } from './types';

export interface SignalDiff {
  signal: Signal;
  status: 'new' | 'gone' | 'strengthened' | 'weakened' | 'unchanged';
  previousStrength?: SignalStrength;
}

export interface ReportComparison {
  current: Report;
  previous: Report;
  newSignals: Signal[];
  goneSignals: Signal[];
  strengthened: Array<{ signal: Signal; from: SignalStrength }>;
  weakened: Array<{ signal: Signal; from: SignalStrength }>;
  postCountDelta: number;
  postCountPercent: number;
}

const STRENGTH_ORDER: Record<SignalStrength, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findMatchingSignal(signal: Signal, candidates: Signal[]): Signal | undefined {
  const normalized = normalizeTitle(signal.title);
  return candidates.find(
    (c) =>
      normalizeTitle(c.title) === normalized ||
      (c.category === signal.category && normalizeTitle(c.title) === normalized)
  );
}

export function compareReports(current: Report, previous: Report): ReportComparison {
  const newSignals: Signal[] = [];
  const strengthened: Array<{ signal: Signal; from: SignalStrength }> = [];
  const weakened: Array<{ signal: Signal; from: SignalStrength }> = [];

  for (const sig of current.signals) {
    const prev = findMatchingSignal(sig, previous.signals);
    if (!prev) {
      newSignals.push(sig);
    } else if (STRENGTH_ORDER[sig.strength] > STRENGTH_ORDER[prev.strength]) {
      strengthened.push({ signal: sig, from: prev.strength });
    } else if (STRENGTH_ORDER[sig.strength] < STRENGTH_ORDER[prev.strength]) {
      weakened.push({ signal: sig, from: prev.strength });
    }
  }

  const goneSignals = previous.signals.filter((prev) => !findMatchingSignal(prev, current.signals));

  const postCountDelta = current.totalPostsAnalyzed - previous.totalPostsAnalyzed;
  const postCountPercent =
    previous.totalPostsAnalyzed > 0
      ? Math.round((postCountDelta / previous.totalPostsAnalyzed) * 100)
      : 0;

  return {
    current,
    previous,
    newSignals,
    goneSignals,
    strengthened,
    weakened,
    postCountDelta,
    postCountPercent,
  };
}

import { SignalCard } from '@entities/signal';
import { SignalFilter } from '@features/filter-signals';
import type { Signal, SignalCategory } from '@shared/lib/types';
import { useState } from 'react';

interface SignalListProps {
  signals: Signal[];
}

export function SignalList({ signals }: SignalListProps) {
  const [activeCategory, setActiveCategory] = useState<SignalCategory | 'all'>('all');

  const filtered =
    activeCategory === 'all' ? signals : signals.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-4">
      <SignalFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No signals in this category.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}

import { cn } from '@shared/lib/cn';
import type { SignalCategory } from '@shared/lib/types';
import { AlertTriangle, Filter, Lightbulb, Sparkles, TrendingUp } from 'lucide-react';

interface SignalFilterProps {
  activeCategory: SignalCategory | 'all';
  onCategoryChange: (category: SignalCategory | 'all') => void;
}

const categories: { key: SignalCategory | 'all'; label: string; icon: typeof Filter }[] = [
  { key: 'all', label: 'All', icon: Filter },
  { key: 'emerging_topic', label: 'New Topics', icon: Sparkles },
  { key: 'growing_trend', label: 'Growing', icon: TrendingUp },
  { key: 'pain_point', label: 'Pain Points', icon: AlertTriangle },
  { key: 'hypothesis', label: 'Hypotheses', icon: Lightbulb },
];

export function SignalFilter({ activeCategory, onCategoryChange }: SignalFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onCategoryChange(key)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
            activeCategory === key
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

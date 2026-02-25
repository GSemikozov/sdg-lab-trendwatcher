import { useAppStore } from '@shared/lib/store';
import type { SubredditConfig } from '@shared/lib/types';
import { Badge, Button } from '@shared/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

const SUGGESTED_SUBREDDITS: SubredditConfig[] = [
  { name: 'lonely', enabled: true, category: 'loneliness' },
  { name: 'depression', enabled: true, category: 'mental health' },
  { name: 'socialskills', enabled: true, category: 'communication' },
  { name: 'socialanxiety', enabled: false, category: 'communication' },
  { name: 'mentalhealth', enabled: false, category: 'mental health' },
  { name: 'relationships', enabled: false, category: 'relationships' },
  { name: 'selfimprovement', enabled: false, category: 'growth' },
];

export function SubredditPicker() {
  const subreddits = useAppStore((s) => s.subreddits);
  const setSubreddits = useAppStore((s) => s.setSubreddits);
  const [customInput, setCustomInput] = useState('');

  const toggleSubreddit = (name: string) => {
    const existing = subreddits.find((s) => s.name === name);
    if (existing) {
      setSubreddits(
        subreddits.map((s) => (s.name === name ? { ...s, enabled: !s.enabled } : s))
      );
    } else {
      const suggested = SUGGESTED_SUBREDDITS.find((s) => s.name === name);
      setSubreddits([
        ...subreddits,
        suggested ?? { name, enabled: true, category: 'custom' },
      ]);
    }
  };

  const removeSubreddit = (name: string) => {
    setSubreddits(subreddits.filter((s) => s.name !== name));
  };

  const addCustom = () => {
    const name = customInput.trim().toLowerCase().replace(/^r\//, '');
    if (name && !subreddits.some((s) => s.name === name)) {
      setSubreddits([...subreddits, { name, enabled: true, category: 'custom' }]);
      setCustomInput('');
    }
  };

  const allNames = new Set(subreddits.map((s) => s.name));
  const suggestionsToShow = SUGGESTED_SUBREDDITS.filter((s) => !allNames.has(s.name));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Active subreddits</h3>
        <div className="flex flex-wrap gap-2">
          {subreddits.map((sub) => (
            <button
              key={sub.name}
              type="button"
              onClick={() => toggleSubreddit(sub.name)}
              className="group flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-colors hover:border-primary/50 cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full ${sub.enabled ? 'bg-trend-up' : 'bg-muted-foreground'}`}
              />
              <span className={sub.enabled ? 'text-foreground' : 'text-muted-foreground'}>
                r/{sub.name}
              </span>
              <X
                className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSubreddit(sub.name);
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {suggestionsToShow.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Suggested</h3>
          <div className="flex flex-wrap gap-2">
            {suggestionsToShow.map((sub) => (
              <button
                key={sub.name}
                type="button"
                onClick={() => toggleSubreddit(sub.name)}
                className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                r/{sub.name}
                <Badge variant="default" className="ml-1 text-[10px]">
                  {sub.category}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Add custom subreddit..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <Button variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

import { useAppStore } from '@shared/lib/store';
import type { Space } from '@shared/lib/types';
import { Badge, Button } from '@shared/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

const SUGGESTED_SUBREDDITS = [
  { name: 'lonely', category: 'loneliness' },
  { name: 'depression', category: 'mental health' },
  { name: 'socialskills', category: 'communication' },
  { name: 'socialanxiety', category: 'communication' },
  { name: 'mentalhealth', category: 'mental health' },
  { name: 'relationships', category: 'relationships' },
  { name: 'selfimprovement', category: 'growth' },
  { name: 'astrology', category: 'cosmic' },
  { name: 'tarot', category: 'cosmic' },
  { name: 'aging', category: 'wellness' },
  { name: 'companionship', category: 'connection' },
];

export function SubredditPicker() {
  const activeSpace = useAppStore((s) => s.spaces.find((sp) => sp.id === s.activeSpaceId));
  const updateSpaceSettings = useAppStore((s) => s.updateSpaceSettings);
  const [customInput, setCustomInput] = useState('');

  const subreddits = activeSpace?.subreddits ?? [];

  const updateSubs = (newSubs: string[]) => {
    updateSpaceSettings({ subreddits: newSubs } as Partial<Space>);
  };

  const sanitizeName = (raw: string) =>
    raw.trim().toLowerCase().replace(/^r\//, '').replace(/\/+$/, '');

  const addSubreddit = (name: string) => {
    const clean = sanitizeName(name);
    if (clean && !subreddits.includes(clean)) {
      updateSubs([...subreddits, clean]);
    }
  };

  const removeSubreddit = (name: string) => {
    updateSubs(subreddits.filter((s) => s !== name));
  };

  const addCustom = () => {
    addSubreddit(customInput);
    setCustomInput('');
  };

  const suggestionsToShow = SUGGESTED_SUBREDDITS.filter((s) => !subreddits.includes(s.name));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Active subreddits</h3>
        {subreddits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-signal-medium/40 bg-signal-medium/5 px-4 py-3">
            <p className="text-sm text-signal-medium">
              No subreddits selected. Add at least one to generate reports.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subreddits.map((name) => (
              <div
                key={name}
                className="group flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-trend-up" />
                <span className="text-foreground">r/{name}</span>
                <button
                  type="button"
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                  onClick={() => removeSubreddit(name)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {suggestionsToShow.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Suggested</h3>
          <div className="flex flex-wrap gap-2">
            {suggestionsToShow.map((sub) => (
              <button
                key={sub.name}
                type="button"
                onClick={() => addSubreddit(sub.name)}
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

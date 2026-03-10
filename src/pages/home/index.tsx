import { useAppStore } from '@shared/lib/store';
import type { Space } from '@shared/lib/types';
import { BarChart3, Plus, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomePage() {
  const spaces = useAppStore((s) => s.spaces);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);

  if (!settingsLoaded) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-foreground">SDG Lab TrendWatcher</h2>
        <p className="mt-2 text-muted-foreground">
          Daily signal intelligence from Reddit — pick a space to explore reports
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
        <CreateSpaceCard />
      </div>
    </main>
  );
}

function SpaceCard({ space }: { space: Space }) {
  return (
    <Link
      to={`/spaces/${space.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {space.name}
          </h3>
        </div>
      </div>

      {space.description && (
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{space.description}</p>
      )}

      <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Radio className="h-3.5 w-3.5" />
        <span>
          {space.subreddits.length > 0
            ? space.subreddits.map((s) => `r/${s}`).join(', ')
            : 'No subreddits configured'}
        </span>
      </div>
    </Link>
  );
}

function CreateSpaceCard() {
  return (
    <Link
      to="/spaces/new"
      className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-6 transition-all hover:border-primary/40 hover:bg-card"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
        <Plus className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <span className="mt-3 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        New space
      </span>
    </Link>
  );
}

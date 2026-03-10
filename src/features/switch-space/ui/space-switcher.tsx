import { useAppStore } from '@shared/lib/store';
import { ChevronDown, Globe, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function SpaceSwitcher() {
  const spaces = useAppStore((s) => s.spaces);
  const activeSpaceId = useAppStore((s) => s.activeSpaceId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const isOnSpacePage = location.pathname.startsWith('/spaces/');

  if (spaces.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={(e) => {
          if (!ref.current?.contains(e.relatedTarget)) setOpen(false);
        }}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent cursor-pointer"
      >
        <Globe className="h-4 w-4 text-primary" />
        <span className="max-w-[160px] truncate font-medium text-foreground">
          {isOnSpacePage && activeSpace ? activeSpace.name : 'Select space'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg">
          {spaces.map((space) => (
            <Link
              key={space.id}
              to={`/spaces/${space.slug}`}
              onClick={() => setOpen(false)}
              className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent first:rounded-t-lg ${
                space.id === activeSpaceId && isOnSpacePage ? 'bg-primary/10' : ''
              }`}
            >
              <span className="text-sm font-medium text-foreground">{space.name}</span>
              {space.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {space.description}
                </span>
              )}
            </Link>
          ))}
          <Link
            to="/spaces/new"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-b-lg border-t border-border px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            New space
          </Link>
        </div>
      )}
    </div>
  );
}

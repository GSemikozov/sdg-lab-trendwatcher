import { SpaceSwitcher } from '@features/switch-space';
import { Badge } from '@shared/ui';
import { BarChart3 } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">TrendWatcher</h1>
                <p className="text-xs text-muted-foreground">Signal intelligence</p>
              </div>
            </Link>
            <SpaceSwitcher />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info">MVP</Badge>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

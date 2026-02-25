import { SubredditPicker } from '@features/configure-subreddits';
import { getAIServiceType, getOpenAIAPIKey } from '@shared/config/ai';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui';
import {
  ArrowLeft,
  Database,
  Radio,
  Settings,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function SettingsPage() {
  const aiType = getAIServiceType();
  const hasKey = !!getOpenAIAPIKey();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-bold text-foreground">Settings</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <CardTitle>Subreddits</CardTitle>
            </div>
            <CardDescription>
              Configure which subreddits to monitor for trend analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubredditPicker />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>AI Provider</CardTitle>
            </div>
            <CardDescription>Analysis engine configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={aiType === 'openai' && hasKey ? 'success' : 'danger'}>
                {aiType === 'openai' && hasKey ? 'OpenAI connected' : 'Not configured'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {aiType === 'openai' && hasKey
                  ? 'Using gpt-4o-mini for analysis'
                  : 'Set VITE_AI_SERVICE_TYPE=openai and VITE_OPENAI_API_KEY in .env'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>Storage</CardTitle>
            </div>
            <CardDescription>Report storage backend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={supabaseUrl ? 'success' : 'danger'}>
                {supabaseUrl ? 'Supabase connected' : 'Not configured'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {supabaseUrl || 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'}
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

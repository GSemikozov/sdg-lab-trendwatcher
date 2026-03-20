import { EmailRecipients } from '@features/configure-email';
import { SubredditPicker } from '@features/configure-subreddits';
import {
  CREATIVE_IMAGE_EXAMPLE_MINIMAL_SPIRITUAL,
  CREATIVE_IMAGE_EXAMPLE_SLEEVE_TEXT,
} from '@shared/lib/creative-image-prompt-examples';
import { useAppStore } from '@shared/lib/store';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui';
import {
  ArrowLeft,
  Database,
  FileText,
  Globe,
  ImageIcon,
  Mail,
  Radio,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

function DomainPromptCard() {
  const activeSpace = useAppStore((s) => s.spaces.find((sp) => sp.id === s.activeSpaceId));
  const updateSpaceSettings = useAppStore((s) => s.updateSpaceSettings);
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const spaceDomainPrompt = activeSpace?.domainPrompt;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form when space changes
  useEffect(() => {
    setValue(spaceDomainPrompt ?? '');
  }, [activeSpace?.id, spaceDomainPrompt]);

  const handleSave = () => {
    updateSpaceSettings({ domainPrompt: value });
    setSaved(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle>Domain Prompt</CardTitle>
        </div>
        <CardDescription>
          AI context for this space — describes the company, domain focus, and what to look for
        </CardDescription>
      </CardHeader>
      <CardContent>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
          placeholder="You are a trend analyst for [Company], a company building..."
        />
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={value === (activeSpace?.domainPrompt ?? '')}
          >
            Save prompt
          </Button>
          {saved && <span className="text-xs text-trend-up">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function CreativeImagePromptCard() {
  const activeSpace = useAppStore((s) => s.spaces.find((sp) => sp.id === s.activeSpaceId));
  const updateSpaceSettings = useAppStore((s) => s.updateSpaceSettings);
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const spacePrompt = activeSpace?.creativeImagePrompt;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form when space changes
  useEffect(() => {
    setValue(spacePrompt ?? '');
  }, [activeSpace?.id, spacePrompt]);

  const handleSave = () => {
    updateSpaceSettings({ creativeImagePrompt: value });
    setSaved(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <CardTitle>Creative image prompt</CardTitle>
        </div>
        <CardDescription>
          Extra instructions for DALL-E when generating weekly ad creatives (saved to Google Drive).
          Leave empty to use the default style. The creative title and description from the report are
          always appended below your text. API outputs <strong>1024×1024</strong> — describe composition
          accordingly; on-image text may be imperfect.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
          placeholder="Paste or write your image brief (style, scene, mood, composition)…"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValue(CREATIVE_IMAGE_EXAMPLE_MINIMAL_SPIRITUAL)}
          >
            Insert example 1 (spiritual / square)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValue(CREATIVE_IMAGE_EXAMPLE_SLEEVE_TEXT)}
          >
            Insert example 2 (sleeve text / vertical)
          </Button>
        </div>
        <details className="mt-4 rounded-md border border-border bg-card/50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            Reference: full example prompts (same as buttons above)
          </summary>
          <div className="mt-3 space-y-4 text-muted-foreground">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                Example 1 — minimalist spiritual
              </p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2 text-xs">
                {CREATIVE_IMAGE_EXAMPLE_MINIMAL_SPIRITUAL}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                Example 2 — photoreal sleeve + copy
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2 text-xs">
                {CREATIVE_IMAGE_EXAMPLE_SLEEVE_TEXT}
              </pre>
            </div>
          </div>
        </details>
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={value === (activeSpace?.creativeImagePrompt ?? '')}
          >
            Save prompt
          </Button>
          {saved && <span className="text-xs text-trend-up">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function SpaceInfoCard() {
  const activeSpace = useAppStore((s) => s.spaces.find((sp) => sp.id === s.activeSpaceId));
  const updateSpaceSettings = useAppStore((s) => s.updateSpaceSettings);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const spaceName = activeSpace?.name;
  const spaceDesc = activeSpace?.description;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form when space changes
  useEffect(() => {
    setName(spaceName ?? '');
    setDescription(spaceDesc ?? '');
  }, [activeSpace?.id, spaceName, spaceDesc]);

  const hasChanges =
    name !== (activeSpace?.name ?? '') || description !== (activeSpace?.description ?? '');

  const handleSave = () => {
    updateSpaceSettings({ name, description });
    setSaved(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle>Space Info</CardTitle>
        </div>
        <CardDescription>Name and description for this space</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label htmlFor="settings-name" className="mb-1 block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="settings-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="settings-desc" className="mb-1 block text-sm font-medium text-foreground">
            Description
          </label>
          <input
            id="settings-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            placeholder="Short description of this project"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            Save
          </Button>
          {saved && <span className="text-xs text-trend-up">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SpaceSettingsPage() {
  const { slug } = useParams<{ slug: string }>();

  const spaces = useAppStore((s) => s.spaces);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const activeSpaceId = useAppStore((s) => s.activeSpaceId);
  const setActiveSpace = useAppStore((s) => s.setActiveSpace);

  const space = spaces.find((s) => s.slug === slug);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync store with URL slug
  useEffect(() => {
    if (space && space.id !== activeSpaceId) {
      setActiveSpace(space.id);
    }
  }, [space?.id, activeSpaceId]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!settingsLoaded) return null;

  if (!space) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to={`/spaces/${slug}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {space.name}
        </Link>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Settings</h2>
        </div>
      </div>

      <div className="space-y-6">
        <SpaceInfoCard />

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
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email Recipients</CardTitle>
            </div>
            <CardDescription>Who receives the daily TrendWatcher report via email</CardDescription>
          </CardHeader>
          <CardContent>
            <EmailRecipients />
          </CardContent>
        </Card>

        <DomainPromptCard />

        <CreativeImagePromptCard />

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
              <Badge variant={supabaseUrl ? 'success' : 'danger'}>
                {supabaseUrl ? 'OpenAI via Edge Function' : 'Not configured'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {supabaseUrl
                  ? 'gpt-4o-mini — API key secured server-side'
                  : 'Connect Supabase to enable AI analysis'}
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

        <DeleteSpaceCard spaceId={space.id} spaceName={space.name} />
      </div>
    </main>
  );
}

function DeleteSpaceCard({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const removeSpace = useAppStore((s) => s.removeSpace);
  const spaces = useAppStore((s) => s.spaces);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isLastSpace = spaces.length <= 1;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeSpace(spaceId);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete space:', err);
      setIsDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <Card className="border-signal-high/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-signal-high" />
          <CardTitle className="text-signal-high">Danger Zone</CardTitle>
        </div>
        <CardDescription>Irreversible actions for this space</CardDescription>
      </CardHeader>
      <CardContent>
        {isLastSpace ? (
          <p className="text-sm text-muted-foreground">
            This is the only space — it cannot be deleted. Create another space first.
          </p>
        ) : confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Delete <strong>{spaceName}</strong> and all its reports? This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="destructive" size="sm" onClick={handleDelete} loading={isDeleting}>
                Yes, delete space
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Delete this space, its settings, and all reports.
            </p>
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              Delete space
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

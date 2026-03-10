import { createSpace } from '@shared/api';
import { useAppStore } from '@shared/lib/store';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function CreateSpacePage() {
  const loadSpaces = useAppStore((s) => s.loadSpaces);
  const setActiveSpace = useAppStore((s) => s.setActiveSpace);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domainPrompt, setDomainPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const space = await createSpace({
        name: name.trim(),
        slug,
        description: description.trim(),
        domainPrompt: domainPrompt.trim(),
        subreddits: [],
        emailRecipients: [],
      });
      await loadSpaces();
      setActiveSpace(space.id);
      navigate(`/spaces/${space.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to spaces
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create New Space</CardTitle>
          <CardDescription>
            Each space monitors its own set of subreddits and generates independent reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="space-name" className="mb-1 block text-sm font-medium text-foreground">
              Name *
            </label>
            <input
              id="space-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NewCircle, Astrix"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="space-desc" className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <input
              id="space-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the project"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="space-prompt"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Domain Prompt
            </label>
            <textarea
              id="space-prompt"
              value={domainPrompt}
              onChange={(e) => setDomainPrompt(e.target.value)}
              rows={5}
              placeholder="You are a trend analyst for [Company], a company building..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Describes the company context and domain focus for AI analysis. Can be edited later in
              Settings.
            </p>
          </div>

          {error && <p className="text-sm text-signal-high">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={isCreating}>
              Create Space
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

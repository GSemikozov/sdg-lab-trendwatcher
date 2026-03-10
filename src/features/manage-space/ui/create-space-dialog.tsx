import { createSpace } from '@shared/api';
import { useAppStore } from '@shared/lib/store';
import { Button } from '@shared/ui';
import { X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateSpaceDialog({ open, onClose }: Props) {
  const loadSpaces = useAppStore((s) => s.loadSpaces);
  const setActiveSpace = useAppStore((s) => s.setActiveSpace);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domainPrompt, setDomainPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

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
      setName('');
      setDescription('');
      setDomainPrompt('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Create New Space</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
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

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={isCreating}>
              Create Space
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

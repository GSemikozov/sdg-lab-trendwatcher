import { useAppStore } from '@shared/lib/store';
import { Button } from '@shared/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailRecipients() {
  const recipients = useAppStore((s) => s.emailRecipients);
  const setRecipients = useAppStore((s) => s.setEmailRecipients);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setError('Invalid email format');
      return;
    }
    if (recipients.includes(email)) {
      setError('Already added');
      return;
    }

    setRecipients([...recipients, email]);
    setInput('');
    setError('');
  };

  const removeEmail = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  return (
    <div className="space-y-3">
      {recipients.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {recipients.map((email) => (
            <span
              key={email}
              className="group flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground"
            >
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="text-muted-foreground transition-colors hover:text-signal-high cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No recipients configured. Reports will still be saved but no emails sent.
        </p>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="email"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
            placeholder="Add email address..."
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-signal-high">{error}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={addEmail} disabled={!input.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

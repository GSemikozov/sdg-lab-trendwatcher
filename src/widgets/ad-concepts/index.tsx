import type { AdConcept } from '@shared/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import { Sparkles } from 'lucide-react';

interface AdConceptsProps {
  concepts?: AdConcept[];
}

export function AdConceptsSection({ concepts }: AdConceptsProps) {
  if (!concepts || concepts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Creative Concepts for Ads</CardTitle>
            <p className="text-xs text-muted-foreground">
              3–5 high-level creative directions for Meta ads, synthesized from emerging topics,
              growing trends, and pain points.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {concepts.slice(0, 5).map((concept, index) => (
            <div
              key={concept.title || index}
              className="flex h-full flex-col rounded-lg border border-border bg-card/70 p-4"
            >
              <h3 className="mb-2 text-sm font-semibold text-foreground">{concept.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{concept.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

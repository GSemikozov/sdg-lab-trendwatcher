import { cn } from '@shared/lib/cn';
import type { HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variants: Record<string, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-trend-up/15 text-trend-up border-trend-up/30',
  warning: 'bg-signal-medium/15 text-signal-medium border-signal-medium/30',
  danger: 'bg-signal-high/15 text-signal-high border-signal-high/30',
  info: 'bg-primary/15 text-primary border-primary/30',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

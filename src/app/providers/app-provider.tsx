import type { ReactNode } from 'react';
import { QueryProvider } from './query-provider';

export function AppProvider({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}

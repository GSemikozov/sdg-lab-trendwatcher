import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonJwt = (import.meta.env.VITE_SUPABASE_ANON_JWT as string | undefined)?.trim();
const anonPublishable = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
// Edge Functions gateway rejects sb_publishable_*; legacy JWT works for REST + Functions.
const supabaseKey = anonJwt || anonPublishable;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_JWT) must be set in .env',
  );
}

if (import.meta.env.DEV && supabaseKey.startsWith('sb_publishable')) {
  console.warn(
    '[TrendWatcher] VITE_SUPABASE_ANON_KEY is a publishable key — Edge Functions return 401. Set VITE_SUPABASE_ANON_JWT to the legacy anon JWT (Dashboard → Settings → API → anon public, starts with eyJ).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

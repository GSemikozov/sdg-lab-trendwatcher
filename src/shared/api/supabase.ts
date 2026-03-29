import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Edge Functions HTTP gateway expects a legacy JWT (eyJ...) in Authorization + apikey.
 * `sb_publishable_*` keys work for PostgREST but return 401 on functions.invoke.
 * Set VITE_SUPABASE_ANON_JWT to the legacy anon key from Dashboard → API when using a publishable key.
 */
export function edgeFunctionInvokeHeaders(): Record<string, string> {
  const fromJwt = (import.meta.env.VITE_SUPABASE_ANON_JWT as string | undefined)?.trim();
  // supabaseKey is guaranteed after the guard above; use it when JWT override is unset
  const key = fromJwt || supabaseKey;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

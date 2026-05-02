import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireEnv } from '@/lib/env';

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: { path?: string; maxAge?: number }) => {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* read-only context (server component); ignored */
          }
        },
        remove: (name: string, options: { path?: string; maxAge?: number }) => {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            /* same */
          }
        },
      },
    },
  );
}

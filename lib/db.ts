import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './authErrors';

// Lazily read credentials when a handler accesses the client, never during build.
export function getSupabase() {
  requireEnv('SUPABASE_URL', 'SUPABASE_SERVICE_KEY');
  return createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabase();
    const value = Reflect.get(client, property);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

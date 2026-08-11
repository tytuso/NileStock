import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable browser credentials for the shared Nile Core project.
// Environment variables override these values when NileStock moves projects.
const defaultSupabaseUrl = "https://dpmajonvvhopjnupgfpq.supabase.co";
const defaultSupabasePublishableKey =
  "sb_publishable_64LPWeBCLp_4yxDvB5XGiw_rwcFcgO7";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  defaultSupabasePublishableKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes("YOUR_PROJECT") &&
    !supabaseKey.includes("YOUR_SUPABASE"),
);

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseKey) return null;
  if (!browserClient)
    browserClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  return browserClient;
}

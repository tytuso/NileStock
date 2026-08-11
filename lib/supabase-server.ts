import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./supabase";

export function getSupabaseServerClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Browser Supabase client for client components
 * This client automatically handles PKCE cookies for OAuth flows via @supabase/ssr
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}


/**
 * Server Supabase client setup for Next.js App Router
 * For browser/client components, use @/lib/supabase-client instead
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          cookieStore.set({
            name,
            value,
            path: "/",
            ...(options || {}),
          });
        },
        remove(name: string, options?: Record<string, unknown>) {
          cookieStore.set({
            name,
            value: "",
            path: "/",
            maxAge: 0,
            ...(options || {}),
          });
        },
      },
    }
  );
}

export async function createServiceRoleClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


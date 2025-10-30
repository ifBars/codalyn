/**
 * Server Supabase client setup for Next.js App Router
 * For browser/client components, use @/lib/supabase-client instead
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a read-only Supabase client for Server Components
 * Cookies can only be read, not modified (set/remove are no-ops)
 * Use this in Server Components during render
 */
export async function createReadOnlyServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // No-op: Cookies cannot be modified in Server Components
        },
        remove() {
          // No-op: Cookies cannot be modified in Server Components
        },
      },
    }
  );
}

/**
 * Creates a writable Supabase client for Server Actions and Route Handlers
 * Cookies can be read and modified
 * Use this in Server Actions and Route Handlers only
 */
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


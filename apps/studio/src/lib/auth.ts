/**
 * Supabase Auth helpers for Next.js App Router
 */

import { createReadOnlyServerSupabaseClient } from "./supabase";
import { redirect } from "next/navigation";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export async function getSession() {
  const supabase = await createReadOnlyServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const supabase = await createReadOnlyServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

/**
 * Ensures a user record exists in the database, creating it if necessary
 * This syncs Supabase Auth users with the database users table
 */
export async function ensureUser() {
  const authUser = await getUser();
  if (!authUser) {
    return null;
  }

  // Check if user exists in database
  let dbUser = await db.query.users.findFirst({
    where: eq(users.id, authUser.id),
  });

  // If user doesn't exist, create them
  if (!dbUser) {
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          id: authUser.id, // Use Supabase auth user ID
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null,
          image: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        })
        .returning();
      return newUser;
    } catch (error) {
      // If insert fails (e.g., due to race condition or duplicate), try to fetch again
      dbUser = await db.query.users.findFirst({
        where: eq(users.id, authUser.id),
      });
      if (dbUser) {
        return dbUser;
      }
      // If still not found, re-throw the error
      throw error;
    }
  }

  return dbUser;
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    redirect("/auth/signin");
  }
  
  // Ensure user exists in database
  await ensureUser();
  
  return user;
}

export async function signOut() {
  // Note: This function requires cookie modification, so it should only be called
  // from Server Actions or Route Handlers. Consider using signOutAction instead.
  const { createServerSupabaseClient } = await import("./supabase");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/auth/signin");
}

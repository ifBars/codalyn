"use server";

/**
 * Server actions for authentication
 */

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    redirect("/auth/signin?error=" + encodeURIComponent(error.message));
  }

  redirect("/auth/signin?email_sent=true");
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/auth/signin");
}


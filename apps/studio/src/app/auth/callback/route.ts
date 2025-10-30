import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  
  // If there's an error from the OAuth provider
  if (error) {
    const errorMessage = errorDescription || error;
    redirect(`/auth/signin?error=${encodeURIComponent(errorMessage)}`);
  }
  
  // If there's no code, redirect to signin
  if (!code) {
    redirect("/auth/signin?error=" + encodeURIComponent("No authorization code received"));
  }
  
  const cookieStore = await cookies();
  
  // Create response early so we can set cookies on it
  const response = NextResponse.redirect(new URL("/projects", request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          response.cookies.set(name, value, {
            path: "/",
            ...options,
          });
        },
        remove(name: string, options) {
          response.cookies.set(name, "", {
            path: "/",
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  try {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error("Error exchanging code for session:", exchangeError);
      redirect("/auth/signin?error=" + encodeURIComponent(exchangeError.message));
    }

    if (!data?.session) {
      console.error("No session created after code exchange");
      redirect("/auth/signin?error=" + encodeURIComponent("Failed to create session"));
    }

    return response;
  } catch (error) {
    console.error("Unexpected error in callback:", error);
    redirect(
      "/auth/signin?error=" + 
      encodeURIComponent(error instanceof Error ? error.message : "An unexpected error occurred")
    );
  }
}


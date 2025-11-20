import { NextRequest, NextResponse } from "next/server";

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTEXT7_API_BASE = "https://context7.com/api";

/**
 * API route to resolve a library name to Context7-compatible library ID
 * 
 * This endpoint proxies requests to Context7's REST API search endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const libraryName = searchParams.get("libraryName");
    const apiKey = request.headers.get("x-context7-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");

    if (!libraryName) {
      return NextResponse.json(
        { error: "libraryName parameter is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required. Provide it via x-context7-api-key header or Authorization header." },
        { status: 401 }
      );
    }

    // Call Context7 search API
    // See: https://context7.com/docs/api-reference/search/search-libraries
    const searchUrl = `${CONTEXT7_API_BASE}/v1/search/libraries?query=${encodeURIComponent(libraryName)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform the response to match expected format
    const libraries = (data.results || []).map((lib: any) => ({
      libraryId: lib.id,
      name: lib.title || lib.id,
      description: lib.description || "",
      stars: lib.stars,
      trustScore: lib.trustScore,
      benchmarkScore: lib.benchmarkScore,
      versions: lib.versions || [],
    }));

    return NextResponse.json({
      libraryName,
      libraries,
      metadata: data.metadata,
    });
  } catch (error) {
    console.error("[Context7 API] Error in resolve request:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


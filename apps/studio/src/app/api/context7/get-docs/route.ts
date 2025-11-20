import { NextRequest, NextResponse } from "next/server";

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTEXT7_API_BASE = "https://context7.com/api";

/**
 * API route to get library documentation from Context7
 * 
 * This endpoint proxies requests to Context7's REST API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const library = searchParams.get("library");
    const topic = searchParams.get("topic");
    const tokens = searchParams.get("tokens") || "10000";
    const version = searchParams.get("version");
    const apiKey = request.headers.get("x-context7-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
    const type = searchParams.get("type") || "txt"; // txt or json

    if (!library) {
      return NextResponse.json(
        { error: "Library parameter is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required. Provide it via x-context7-api-key header or Authorization header." },
        { status: 401 }
      );
    }

    // Normalize library ID format (ensure it starts with /)
    let libraryId = library.startsWith("/") ? library : `/${library}`;
    
    // Build the API URL
    // Format: /v1/{owner}/{repo} or /v1/{owner}/{repo}/{version}
    let apiUrl = `${CONTEXT7_API_BASE}/v1${libraryId}`;
    if (version) {
      apiUrl += `/${version}`;
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append("type", type);
    if (topic) {
      queryParams.append("topic", topic);
    }
    if (tokens) {
      queryParams.append("tokens", tokens);
    }
    apiUrl += `?${queryParams.toString()}`;

    // Call Context7 API
    const response = await fetch(apiUrl, {
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
          retryAfterSeconds: errorData.retryAfterSeconds,
        },
        { status: response.status }
      );
    }

    // Handle response based on type
    if (type === "json") {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // Plain text response
      const text = await response.text();
      return NextResponse.json({
        library: libraryId,
        content: text,
        type: "txt",
      });
    }
  } catch (error) {
    console.error("[Context7 API] Error in get-docs request:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to get library documentation from Context7
 * 
 * This endpoint proxies requests to Context7's MCP tools.
 * Since MCP tools are not directly accessible from Next.js API routes,
 * this endpoint returns a helpful error message.
 * 
 * The actual documentation fetching should happen via MCP tools when
 * the toolset runs in an environment that supports them.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const library = searchParams.get("library");
    const topic = searchParams.get("topic");
    const tokens = searchParams.get("tokens");
    const version = searchParams.get("version");
    const apiKey = request.headers.get("x-context7-api-key");

    if (!library) {
      return NextResponse.json(
        { error: "Library parameter is required" },
        { status: 400 }
      );
    }

    // Note: Context7 MCP tools don't require API key authentication
    // The API key parameter is kept for compatibility but not used

    // Since this is running in a Next.js API route and MCP tools
    // are only available in the Cursor environment, we return an error
    // indicating that MCP tools should be used directly.
    
    return NextResponse.json(
      {
        error: "Context7 MCP tools must be called directly, not through API routes",
        library,
        topic,
        suggestion: "Use MCP tools directly when available, or ensure the library ID is in format '/org/project'",
      },
      { status: 400 }
    );
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


import { NextRequest, NextResponse } from "next/server";

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API route to resolve a library name to Context7-compatible library ID
 * 
 * This endpoint is a proxy that calls Context7's MCP tools.
 * Since MCP tools are not directly accessible from Next.js API routes,
 * this endpoint returns a helpful response structure.
 * 
 * The actual resolution should happen via MCP tools when the toolset
 * runs in an environment that supports them (like server actions).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const libraryName = searchParams.get("libraryName");
    const apiKey = request.headers.get("x-context7-api-key");

    if (!libraryName) {
      return NextResponse.json(
        { error: "libraryName parameter is required" },
        { status: 400 }
      );
    }

    // Note: Context7 MCP tools don't require API key authentication
    // The API key parameter is kept for compatibility but not used

    // Since this is running in a Next.js API route and MCP tools
    // are only available in the Cursor environment, we return a response
    // that indicates the library name should be resolved via MCP tools.
    // The toolset should handle this appropriately.
    
    // Return a response that matches the MCP tool's expected format
    // Since MCP tools aren't directly callable from API routes, we provide
    // a helpful response that the toolset can use
    const normalizedName = libraryName.toLowerCase();
    
    // Provide common mappings for known libraries
    let suggestedLibraryId: string | null = null;
    if (normalizedName.includes('genai') || normalizedName.includes('js-genai')) {
      suggestedLibraryId = "/googleapis/js-genai";
    } else if (normalizedName.includes('next') || normalizedName === 'next.js') {
      suggestedLibraryId = "/vercel/next.js";
    } else if (normalizedName === 'react') {
      suggestedLibraryId = "/facebook/react";
    }
    
    return NextResponse.json({
      libraryName,
      // Return format similar to MCP tool response
      libraries: suggestedLibraryId ? [{
        libraryId: suggestedLibraryId,
        name: libraryName,
        description: `Suggested library ID for ${libraryName}`,
      }] : [],
      message: suggestedLibraryId 
        ? `Found suggested library ID: ${suggestedLibraryId}`
        : `No direct mapping found for '${libraryName}'. Try using format '/org/project' or search Context7 for similar libraries.`,
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


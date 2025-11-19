/**
 * Browser-specific tools for the Agent system
 * Handles tools that require DOM access like screenshot capture
 */

import { ToolSet, ToolDefinition, ToolCall, ToolResult } from "../core/types";
import { captureIframeScreenshot, getGlobalIframe } from "../../screenshot";

export interface BrowserToolSetConfig {
    iframeRef?: React.RefObject<HTMLIFrameElement>;
}

export class BrowserToolSet implements ToolSet {
    private iframeRef?: React.RefObject<HTMLIFrameElement>;

    constructor(config?: BrowserToolSetConfig) {
        this.iframeRef = config?.iframeRef;
    }

    getDefinitions(): ToolDefinition[] {
        return [
            {
                name: "capture_screenshot",
                description: "Capture a screenshot of the current preview/UI. Use this when you need to see what the application currently looks like, especially after making changes to verify the visual result.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ];
    }

    async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
        if (toolCall.name === "capture_screenshot") {
            try {
                let iframe: HTMLIFrameElement | null = null;

                if (this.iframeRef?.current) {
                    iframe = this.iframeRef.current;
                } else {
                    iframe = getGlobalIframe();
                }

                if (!iframe) {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: "Preview iframe not available. The preview may not be loaded yet.",
                        success: false,
                    };
                }

                if (!iframe.isConnected) {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: "Preview iframe is not connected to the DOM.",
                        success: false,
                    };
                }

                // Check iframe dimensions
                const rect = iframe.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: `Preview iframe has zero dimensions (${rect.width}x${rect.height}). The preview may not be visible yet.`,
                        success: false,
                    };
                }

                // Try to capture screenshot with retries
                let screenshot: string | null = null;
                for (let attempt = 0; attempt < 3; attempt++) {
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                    }

                    try {
                        screenshot = await captureIframeScreenshot(iframe);
                        if (screenshot) break;
                    } catch (e) {
                        // Continue to next attempt
                    }
                }

                if (!screenshot) {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: "Failed to capture screenshot after multiple attempts.",
                        success: false,
                    };
                }

                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: {
                        success: true,
                        screenshot: screenshot,
                        message: "Screenshot captured successfully",
                    },
                    success: true,
                };
            } catch (error) {
                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: null,
                    error: error instanceof Error ? error.message : "Unknown error",
                    success: false,
                };
            }
        }

        return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: `Unknown tool: ${toolCall.name}`,
            success: false,
        };
    }

    hasTool(name: string): boolean {
        return name === "capture_screenshot";
    }

    setIframeRef(iframeRef: React.RefObject<HTMLIFrameElement>): void {
        this.iframeRef = iframeRef;
    }
}

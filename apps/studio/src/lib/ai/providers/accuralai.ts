/**
 * AccuralAI ModelAdapter implementation (now backed directly by @google/genai).
 * We keep the same adapter surface so the rest of the app can remain unchanged.
 */

import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";

import {
    ModelAdapter,
    ModelResponse,
    ModelStreamChunk,
    Message,
    ToolDefinition,
    ToolCall,
} from "../core/types";
import { filterResponseText, containsCodeWithoutTools } from "../core/filters";
import { parseToolCalls } from "../core/parser";

export interface AccuralAIAdapterConfig {
    /** Google API key */
    googleApiKey?: string;
    /** Default model to use (e.g., "google:gemini-2.5-flash" or "gemini-2.5-flash") */
    modelName?: string;
    // Legacy fields kept for compatibility with existing calls (ignored)
    openRouterApiKey?: string;
    openRouterSite?: string;
    openRouterTitle?: string;
    anthropicApiKey?: string;
}

export class AccuralAIAdapter implements ModelAdapter {
    private client: GoogleGenAI;
    private modelName: string;
    // Map sanitized tool names back to original names for tool call execution
    private toolNameMap: Map<string, string> = new Map();

    constructor(config: AccuralAIAdapterConfig) {
        if (!config.googleApiKey) {
            throw new Error("Google API key is required for AccuralAIAdapter (@google/genai)");
        }

        this.client = new GoogleGenAI({ apiKey: config.googleApiKey });
        const requested = config.modelName || "google:gemini-2.5-flash";
        this.modelName = requested.startsWith("google:") ? requested.replace(/^google:/, "") : requested;
    }

    getModelName(): string {
        return this.modelName;
    }

    async generate(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse> {
        console.log("[AI Debug] AccuralAIAdapter.generate() - Starting");
        console.log(`[AI Debug] Model: ${this.modelName}`);
        console.log(`[AI Debug] Input messages: ${messages.length}`);
        console.log(`[AI Debug] Available tools: ${tools.length}`);

        // Clear and rebuild tool name mapping for this request
        this.toolNameMap.clear();

        const contents = this.convertMessagesToGemini(messages);
        console.log(`[AI Debug] Converted to ${contents.length} Gemini content items`);

        const functionDeclarations = tools.map(t => this.convertToolToGeminiFunction(t));

        const request = {
            model: this.modelName,
            contents,
            config: {
                tools: tools.length > 0 ? [{ functionDeclarations }] : undefined,
                toolConfig: tools.length > 0 ? {
                    functionCallingConfig: {
                        mode: FunctionCallingConfigMode.AUTO,
                    },
                } : undefined,
            },
        };

        console.log("[AI Debug] Calling Gemini API...");
        const apiStartTime = Date.now();
        const result = await this.client.models.generateContent(request);
        const apiDuration = Date.now() - apiStartTime;
        console.log(`[AI Debug] Gemini API response received (${apiDuration}ms)`);

        let text = "";
        try {
            if ((result as any).text) {
                text = (result as any).text;
                console.log(`[AI Debug] Extracted text from result.text (${text.length} chars)`);
            } else if (result.candidates && result.candidates[0]?.content?.parts) {
                const textParts = result.candidates[0].content.parts.filter((part: any) => part.text);
                text = textParts.map((part: any) => part.text).join("");
                console.log(`[AI Debug] Extracted text from candidates[0].content.parts (${text.length} chars, ${textParts.length} parts)`);
            } else {
                console.log("[AI Debug] No text found in response");
            }
        } catch (e) {
            console.warn("[AI Debug] Error extracting text:", e);
        }

        let toolCalls = parseToolCalls(result);
        
        // Map sanitized tool names back to original names
        toolCalls = toolCalls.map(tc => {
            const originalName = this.toolNameMap.get(tc.name) || tc.name;
            if (originalName !== tc.name) {
                console.log(`[AI Debug] Mapped sanitized tool name '${tc.name}' back to '${originalName}'`);
            }
            return { ...tc, name: originalName };
        });
        
        if (toolCalls.length > 0) {
            console.log(`[AI Debug] Parsed ${toolCalls.length} tool call(s)`, toolCalls.map(tc => tc.name));
        } else {
            console.log("[AI Debug] No tool calls found in response");
        }

        const hasToolCalls = toolCalls.length > 0;
        if (text) {
            const originalText = text;
            text = filterResponseText(text);
            if (text !== originalText) {
                console.log(`[AI Debug] Response text filtered (${originalText.length} -> ${text.length} chars)`);
            }

            if (containsCodeWithoutTools(text, hasToolCalls)) {
                console.warn("[AI Debug] Rejected response containing code without tool calls");
                text = "ERROR: Code was output directly instead of using tools. Please use the write_file tool to create or modify files. Code must never be output in text responses.";
            }
        }

        console.log(`[AI Debug] AccuralAIAdapter.generate() - Returning response:`, {
            textLength: text?.length || 0,
            toolCallsCount: toolCalls.length,
            finishReason: hasToolCalls ? "tool_calls" : "stop",
        });

        return {
            content: text,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            finishReason: hasToolCalls ? "tool_calls" : "stop",
        };
    }

    async *generateStream(
        messages: Message[],
        tools: ToolDefinition[]
    ): AsyncGenerator<ModelStreamChunk> {
        console.log("[AI Debug] AccuralAIAdapter.generateStream() - Starting");
        console.log(`[AI Debug] Model: ${this.modelName}`);
        console.log(`[AI Debug] Input messages: ${messages.length}`);
        console.log(`[AI Debug] Available tools: ${tools.length}`);

        // Clear and rebuild tool name mapping for this request
        this.toolNameMap.clear();

        const contents = this.convertMessagesToGemini(messages);
        const functionDeclarations = tools.map(t => this.convertToolToGeminiFunction(t));

        const request = {
            model: this.modelName,
            contents,
            config: {
                tools: tools.length > 0 ? [{ functionDeclarations }] : undefined,
                toolConfig: tools.length > 0 ? {
                    functionCallingConfig: {
                        mode: FunctionCallingConfigMode.AUTO,
                    },
                } : undefined,
            },
        };

        console.log("[AI Debug] Starting Gemini API stream...");
        const streamStartTime = Date.now();
        const stream = await this.client.models.generateContentStream(request);
        let chunkCount = 0;

        for await (const chunk of stream) {
            chunkCount++;
            let text = "";
            try {
                if ((chunk as any).text) {
                    text = (chunk as any).text;
                } else if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
                    const textParts = chunk.candidates[0].content.parts.filter((part: any) => part.text);
                    text = textParts.map((part: any) => part.text).join("");
                }
            } catch {
                // ignore extraction errors per chunk
            }

            if (text) {
                yield { type: "text", content: text };
            }

            try {
                let chunkToolCalls = parseToolCalls(chunk);
                
                // Map sanitized tool names back to original names
                chunkToolCalls = chunkToolCalls.map(tc => {
                    const originalName = this.toolNameMap.get(tc.name) || tc.name;
                    if (originalName !== tc.name) {
                        console.log(`[AI Debug] Mapped sanitized tool name '${tc.name}' back to '${originalName}'`);
                    }
                    return { ...tc, name: originalName };
                });
                
                for (const toolCall of chunkToolCalls) {
                    console.log(`[AI Debug] Stream chunk ${chunkCount}: function call - ${toolCall.name}`);
                    yield { type: "tool_call", toolCall };
                }
            } catch (e) {
                console.warn("[AI Debug] Error extracting function calls from chunk:", e);
            }
        }

        const streamDuration = Date.now() - streamStartTime;
        console.log(`[AI Debug] AccuralAIAdapter.generateStream() - Completed (${streamDuration}ms, ${chunkCount} chunks)`);
    }

    /**
     * Convert our Message format to Gemini's Content format
     */
    private convertMessagesToGemini(messages: Message[]): any[] {
        const contents: any[] = [];

        for (const message of messages) {
            if (message.role === "system") {
                contents.push({
                    role: "user",
                    parts: [{ text: message.content || "" }],
                });
            } else if (message.role === "user") {
                contents.push({
                    role: "user",
                    parts: [{ text: message.content || "" }],
                });
            } else if (message.role === "assistant") {
                const parts: any[] = [];

                if (message.content) {
                    parts.push({ text: message.content });
                }

                if (message.toolCalls) {
                    for (const toolCall of message.toolCalls) {
                        parts.push({
                            functionCall: {
                                name: toolCall.name,
                                args: toolCall.args,
                            },
                        });
                    }
                }

                contents.push({
                    role: "model",
                    parts,
                });
            } else if (message.role === "tool") {
                const parts: any[] = [];
                if (message.toolResults) {
                    for (const result of message.toolResults) {
                        parts.push({
                            functionResponse: {
                                name: result.name,
                                response: {
                                    name: result.name,
                                    content: result.result,
                                },
                            },
                        });
                    }
                }

                contents.push({
                    role: "function",
                    parts,
                });
            }
        }

        return contents;
    }

    /**
     * Convert our ToolDefinition format to Gemini's function declaration format
     */
    private convertToolToGeminiFunction(tool: ToolDefinition): any {
        const sanitizedName = this.sanitizeToolName(tool.name);
        
        // Store mapping for reverse lookup when parsing tool calls
        if (sanitizedName !== tool.name) {
            this.toolNameMap.set(sanitizedName, tool.name);
            console.warn(
                `[AI Debug] Sanitized tool name '${tool.name}' -> '${sanitizedName}' to satisfy Gemini naming rules`
            );
        } else {
            // Even if not sanitized, store identity mapping for consistency
            this.toolNameMap.set(sanitizedName, tool.name);
        }

        return {
            name: sanitizedName,
            description: tool.description,
            parameters: tool.parameters,
        };
    }

    /**
     * Enforce Google Gemini naming rules: start with letter/underscore, allow alphanumerics,
     * underscores, dots, colons, and dashes, max length 64. Invalid characters are stripped.
     */
    private sanitizeToolName(name: string): string {
        let sanitized = name.replace(/[^a-zA-Z0-9_.:-]/g, '_');
        if (!/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = `_${sanitized}`;
        }
        if (sanitized.length > 64) {
            sanitized = sanitized.slice(0, 64);
        }
        return sanitized;
    }
}

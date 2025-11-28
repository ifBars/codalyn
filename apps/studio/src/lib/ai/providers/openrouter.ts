// @ts-nocheck
/**
 * OpenRouter ModelAdapter implementation
 */

import { OpenRouter } from "@openrouter/sdk";

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
import { getExecutor } from "@codalyn/tools";

export interface OpenRouterAdapterConfig {
    apiKey: string;
    modelName?: string;
}

export class OpenRouterAdapter implements ModelAdapter {
    private client: OpenRouter;
    private modelName: string;

    constructor(config: OpenRouterAdapterConfig) {
        this.client = new OpenRouter({
            apiKey: config.apiKey,
        });
        this.modelName = config.modelName || "openrouter/auto";
    }

    getModelName(): string {
        return this.modelName;
    }

    async generate(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse> {
        console.log("[AI Debug] OpenRouterAdapter.generate() - Starting");
        console.log(`[AI Debug] Model: ${this.modelName}`);
        console.log(`[AI Debug] Input messages: ${messages.length}`);
        console.log(`[AI Debug] Available tools: ${tools.length}`);
        if (tools.length > 0) {
            const toolsWithExecutors = tools.filter(t => getExecutor(t.name) !== undefined);
            const toolsWithoutExecutors = tools.filter(t => getExecutor(t.name) === undefined);
            console.log(`[AI Debug] Tool names (with executors):`, toolsWithExecutors.map(t => t.name));
            if (toolsWithoutExecutors.length > 0) {
                console.log(`[AI Debug] Tool names (without executors - will fail if called):`, toolsWithoutExecutors.map(t => t.name));
            }
        }

        const openRouterMessages = this.convertMessagesToOpenRouter(messages);
        console.log(`[AI Debug] Converted to ${openRouterMessages.length} OpenRouter messages`);

        // Convert tools to OpenRouter format
        const openRouterTools = tools.length > 0 ? tools.map(t => this.convertToolToOpenRouter(t)) : undefined;

        const request: any = {
            model: this.modelName,
            messages: openRouterMessages,
            stream: false,
        };

        if (openRouterTools && openRouterTools.length > 0) {
            request.tools = openRouterTools;
            // Use "auto" to let the model decide when to call tools
            request.tool_choice = "auto";
        }

        console.log("[AI Debug] Calling OpenRouter API...");
        const apiStartTime = Date.now();
        const result = await this.client.chat.send(request);
        const apiDuration = Date.now() - apiStartTime;
        console.log(`[AI Debug] OpenRouter API response received (${apiDuration}ms)`);

        // Extract text from response
        let text = "";
        try {
            if (result.choices && result.choices[0]?.message?.content) {
                text = result.choices[0].message.content;
                console.log(`[AI Debug] Extracted text from choices[0].message.content (${text.length} chars)`);
            } else {
                console.log("[AI Debug] No text found in response");
            }
        } catch (e) {
            console.warn("[AI Debug] Error extracting text:", e);
        }

        // Extract tool calls - use the generic parser which now handles OpenRouter format
        const toolCalls = parseToolCalls(result);
        if (toolCalls.length > 0) {
            console.log(`[AI Debug] Parsed ${toolCalls.length} tool call(s)`, toolCalls.map(tc => tc.name));
        } else {
            console.log("[AI Debug] No tool calls found in response");
            // Log the response structure for debugging
            console.log("[AI Debug] Response structure:", JSON.stringify(result, null, 2).substring(0, 500));
        }

        // Apply response filtering
        const hasToolCalls = toolCalls.length > 0;
        if (text) {
            const originalText = text;
            text = filterResponseText(text);
            if (text !== originalText) {
                console.log(`[AI Debug] Response text filtered (${originalText.length} -> ${text.length} chars)`);
            }

            // Reject responses that contain code without tool calls
            if (containsCodeWithoutTools(text, hasToolCalls)) {
                console.warn('[AI Debug] Rejected response containing code without tool calls');
                text = 'ERROR: Code was output directly instead of using tools. Please use the write_file tool to create or modify files. Code must never be output in text responses.';
            }
        }

        const finishReason = result.choices?.[0]?.finish_reason || (toolCalls.length > 0 ? "tool_calls" : "stop");

        console.log(`[AI Debug] OpenRouterAdapter.generate() - Returning response:`, {
            textLength: text?.length || 0,
            toolCallsCount: toolCalls.length,
            finishReason,
        });

        return {
            content: text,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            finishReason: finishReason === "tool_calls" ? "tool_calls" : "stop",
        };
    }

    async *generateStream(
        messages: Message[],
        tools: ToolDefinition[]
    ): AsyncGenerator<ModelStreamChunk> {
        console.log("[AI Debug] OpenRouterAdapter.generateStream() - Starting");
        console.log(`[AI Debug] Model: ${this.modelName}`);
        console.log(`[AI Debug] Input messages: ${messages.length}`);
        console.log(`[AI Debug] Available tools: ${tools.length}`);
        if (tools.length > 0) {
            const toolsWithExecutors = tools.filter(t => getExecutor(t.name) !== undefined);
            const toolsWithoutExecutors = tools.filter(t => getExecutor(t.name) === undefined);
            console.log(`[AI Debug] Tool names (with executors):`, toolsWithExecutors.map(t => t.name));
            if (toolsWithoutExecutors.length > 0) {
                console.log(`[AI Debug] Tool names (without executors - will fail if called):`, toolsWithoutExecutors.map(t => t.name));
            }
        }

        const openRouterMessages = this.convertMessagesToOpenRouter(messages);
        console.log(`[AI Debug] Converted to ${openRouterMessages.length} OpenRouter messages`);
        
        // Debug: Log each message to see what's being sent
        openRouterMessages.forEach((msg, idx) => {
            console.log(`[AI Debug] Message ${idx}:`, JSON.stringify(msg, null, 2).substring(0, 500));
        });

        // Convert tools to OpenRouter format
        const openRouterTools = tools.length > 0 ? tools.map(t => this.convertToolToOpenRouter(t)) : undefined;

        const request: any = {
            model: this.modelName,
            messages: openRouterMessages,
            stream: true,
        };

        if (openRouterTools && openRouterTools.length > 0) {
            request.tools = openRouterTools;
            // Use "auto" to let the model decide when to call tools
            request.tool_choice = "auto";
        }

        console.log("[AI Debug] Starting OpenRouter API stream...");
        console.log("[AI Debug] Request:", JSON.stringify(request, null, 2).substring(0, 1000));
        const streamStartTime = Date.now();
        
        try {
            const stream = await this.client.chat.send(request);
            console.log("[AI Debug] Stream object received:", typeof stream, stream?.constructor?.name);
            
            // Check if stream is actually iterable
            if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
                console.error("[AI Debug] Stream is not async iterable!");
                console.error("[AI Debug] Stream type:", typeof stream);
                console.error("[AI Debug] Stream value:", stream);
                return;
            }
            
            let chunkCount = 0;

            for await (const chunk of stream) {
                chunkCount++;
                console.log(`[AI Debug] Received chunk ${chunkCount}:`, JSON.stringify(chunk, null, 2).substring(0, 500));
                
                // Extract text from chunk
                let text = "";
                try {
                    // Try multiple possible locations for content
                    if (chunk.choices?.[0]?.delta?.content) {
                        text = chunk.choices[0].delta.content;
                    } else if (chunk.choices?.[0]?.delta?.reasoning) {
                        // Grok and some models use "reasoning" tokens - we can optionally yield these
                        // For now, we'll skip reasoning tokens as they're internal thinking
                        text = ""; // Don't yield reasoning tokens as content
                    } else if (chunk.choices?.[0]?.message?.content) {
                        text = chunk.choices[0].message.content;
                    } else if ((chunk as any).content) {
                        text = (chunk as any).content;
                    } else if ((chunk as any).delta?.content) {
                        text = (chunk as any).delta.content;
                    }
                } catch (e) {
                    console.warn("[AI Debug] Text extraction failed:", e);
                }

                if (text) {
                    console.log(`[AI Debug] Yielding text chunk: ${text.substring(0, 50)}...`);
                    yield { type: "text", content: text };
                }

                // Extract tool calls from chunk
                try {
                    const delta = chunk.choices?.[0]?.delta;
                    if (!delta) {
                        // Try parsing the whole chunk
                        const chunkToolCalls = parseToolCalls(chunk);
                        if (chunkToolCalls.length > 0) {
                            console.log(`[AI Debug] Found ${chunkToolCalls.length} tool call(s) via parser`);
                            for (const toolCall of chunkToolCalls) {
                                console.log(`[AI Debug] Stream chunk ${chunkCount}: function call - ${toolCall.name}`);
                                yield {
                                    type: "tool_call",
                                    toolCall,
                                };
                            }
                        }
                        continue;
                    }

                    // Check for tool calls in delta - handle both camelCase and snake_case
                    const toolCallsArray = delta.tool_calls || delta.toolCalls;
                    if (toolCallsArray && Array.isArray(toolCallsArray)) {
                        console.log(`[AI Debug] Found ${toolCallsArray.length} tool call(s) in delta (chunk ${chunkCount})`);
                        for (const toolCallDelta of toolCallsArray) {
                            if (toolCallDelta.type === "function" && toolCallDelta.function) {
                                try {
                                    // Parse arguments
                                    let args = {};
                                    if (toolCallDelta.function.arguments) {
                                        try {
                                            args = typeof toolCallDelta.function.arguments === "string"
                                                ? JSON.parse(toolCallDelta.function.arguments)
                                                : toolCallDelta.function.arguments || {};
                                        } catch {
                                            // Partial JSON in streaming - will be completed in later chunks
                                            args = {};
                                        }
                                    }

                                    // Yield if we have a complete tool call (has name and id)
                                    if (toolCallDelta.function.name && toolCallDelta.id) {
                                        console.log(`[AI Debug] Yielding tool call: ${toolCallDelta.function.name}`);
                                        yield {
                                            type: "tool_call",
                                            toolCall: {
                                                id: toolCallDelta.id,
                                                name: toolCallDelta.function.name,
                                                args,
                                            },
                                        };
                                    }
                                } catch (e) {
                                    console.warn(`[AI Debug] Failed to parse streaming tool call delta:`, e);
                                }
                            }
                        }
                    }
                    
                    // Also check for complete tool calls in the message (non-streaming format)
                    const chunkToolCalls = parseToolCalls(chunk);
                    if (chunkToolCalls.length > 0) {
                        console.log(`[AI Debug] Found ${chunkToolCalls.length} tool call(s) via parser`);
                        for (const toolCall of chunkToolCalls) {
                            console.log(`[AI Debug] Stream chunk ${chunkCount}: function call - ${toolCall.name}`);
                            yield {
                                type: "tool_call",
                                toolCall,
                            };
                        }
                    }
                } catch (e) {
                    console.warn("[AI Debug] Error extracting function calls from chunk:", e);
                }
            }
            
            const streamDuration = Date.now() - streamStartTime;
            console.log(`[AI Debug] OpenRouterAdapter.generateStream() - Completed (${streamDuration}ms, ${chunkCount} chunks)`);
        } catch (error) {
            console.error("[AI Debug] Error in OpenRouter streaming:", error);
            throw error;
        }
    }

    /**
     * Convert our Message format to OpenRouter's message format
     */
    private convertMessagesToOpenRouter(messages: Message[]): any[] {
        const openRouterMessages: any[] = [];
        
        // Track tool call IDs from assistant messages to match with tool results
        const toolCallIdMap = new Map<string, string>(); // Maps tool name + args to call ID

        for (const message of messages) {
            if (message.role === "system") {
                // System messages are added as system role in OpenRouter
                openRouterMessages.push({
                    role: "system",
                    content: message.content || "",
                });
            } else if (message.role === "user") {
                openRouterMessages.push({
                    role: "user",
                    content: message.content || "",
                });
            } else if (message.role === "assistant") {
                const msg: any = {
                    role: "assistant",
                };

                // Add content if present (can be empty string or null)
                if (message.content !== undefined && message.content !== null) {
                    msg.content = message.content;
                }

                // Add tool calls if present
                if (message.toolCalls && message.toolCalls.length > 0) {
                    msg.tool_calls = message.toolCalls.map(tc => {
                        const callId = tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
                        // Store mapping for tool result matching
                        const key = `${tc.name}:${JSON.stringify(tc.args)}`;
                        toolCallIdMap.set(key, callId);
                        return {
                            id: callId,
                            type: "function",
                            function: {
                                name: tc.name,
                                arguments: JSON.stringify(tc.args),
                            },
                        };
                    });
                }

                openRouterMessages.push(msg);
            } else if (message.role === "tool") {
                // Tool results - OpenRouter uses "tool" role with toolCallId (camelCase)
                if (message.toolResults && message.toolResults.length > 0) {
                    for (let i = 0; i < message.toolResults.length; i++) {
                        const result = message.toolResults[i];
                        
                        // Convert result to string content
                        let content: string;
                        if (typeof result.result === "string") {
                            content = result.result;
                        } else if (result.result === null || result.result === undefined) {
                            content = "";
                        } else {
                            try {
                                content = JSON.stringify(result.result);
                            } catch (e) {
                                content = String(result.result);
                            }
                        }
                        
                        // Ensure toolCallId is always a valid string
                        let toolCallId: string;
                        
                        // First, try to use the toolCallId from the result
                        if (result.toolCallId && typeof result.toolCallId === "string" && result.toolCallId.trim() !== "") {
                            toolCallId = result.toolCallId;
                        } else {
                            // Try to find matching tool call ID from the map
                            // Look for the most recent matching tool call
                            let foundId: string | undefined;
                            
                            // Try to match by name (positional matching as fallback)
                            // We'll use a simple approach: match by index with previous assistant message
                            const previousAssistantMsg = openRouterMessages
                                .slice()
                                .reverse()
                                .find((msg: any) => msg.role === "assistant" && msg.tool_calls);
                            
                            if (previousAssistantMsg && previousAssistantMsg.tool_calls && previousAssistantMsg.tool_calls[i]) {
                                foundId = previousAssistantMsg.tool_calls[i].id;
                            }
                            
                            if (foundId) {
                                toolCallId = foundId;
                            } else {
                                // Last resort: generate a new ID
                                toolCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
                            }
                        }
                        
                        // OpenRouter requires toolCallId to be a string
                        if (typeof toolCallId !== "string") {
                            toolCallId = String(toolCallId);
                        }
                        
                        // Ensure it's not empty
                        if (!toolCallId || toolCallId.trim() === "") {
                            toolCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
                        }
                        
                        openRouterMessages.push({
                            role: "tool",
                            content: content,
                            toolCallId: toolCallId, // OpenRouter SDK uses camelCase
                        });
                    }
                }
            }
        }

        return openRouterMessages;
    }

    /**
     * Convert our ToolDefinition format to OpenRouter's tool format
     */
    private convertToolToOpenRouter(tool: ToolDefinition): any {
        return {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        };
    }

}


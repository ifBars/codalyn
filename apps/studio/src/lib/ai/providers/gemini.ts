/**
 * Gemini ModelAdapter implementation
 */

import { GoogleGenAI } from "@google/genai";
import type { GenerateContentRequest } from "@google/genai";
import {
    ModelAdapter,
    ModelResponse,
    ModelStreamChunk,
    Message,
    ToolDefinition,
    ToolCall,
} from "../core/types";

export interface GeminiAdapterConfig {
    apiKey: string;
    modelName?: string;
}

export class GeminiAdapter implements ModelAdapter {
    private client: GoogleGenAI;
    private modelName: string;

    constructor(config: GeminiAdapterConfig) {
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.modelName = config.modelName || "gemini-2.0-flash-exp";
    }

    getModelName(): string {
        return this.modelName;
    }

    async generate(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse> {
        const contents = this.convertMessagesToGemini(messages);

        const request: GenerateContentRequest = {
            contents,
            config: {
                tools: tools.length > 0 ? tools.map(t => this.convertToolToGemini(t)) : undefined,
            },
        };

        const result = await this.client.models.generateContent(this.modelName, request);

        // Extract text
        let text = "";
        try {
            if (result.candidates && result.candidates[0]?.content?.parts) {
                const textParts = result.candidates[0].content.parts.filter((part: any) => part.text);
                text = textParts.map((part: any) => part.text).join("");
            }
        } catch (e) {
            // Text extraction failed
        }

        // Extract tool calls
        const toolCalls: ToolCall[] = [];
        if (result.candidates && result.candidates[0]?.content?.parts) {
            for (const part of result.candidates[0].content.parts) {
                if ((part as any).functionCall) {
                    const fc = (part as any).functionCall;
                    toolCalls.push({
                        name: fc.name,
                        args: fc.args as Record<string, any>,
                    });
                }
            }
        }

        return {
            content: text,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
        };
    }

    async *generateStream(
        messages: Message[],
        tools: ToolDefinition[]
    ): AsyncGenerator<ModelStreamChunk> {
        const contents = this.convertMessagesToGemini(messages);

        const request: GenerateContentRequest = {
            contents,
            config: {
                tools: tools.length > 0 ? tools.map(t => this.convertToolToGemini(t)) : undefined,
            },
        };

        const stream = await this.client.models.generateContentStream(this.modelName, request);

        for await (const chunk of stream) {
            // Extract text
            let text = "";
            try {
                if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
                    const textParts = chunk.candidates[0].content.parts.filter((part: any) => part.text);
                    text = textParts.map((part: any) => part.text).join("");
                }
            } catch (e) {
                // Text extraction failed
            }

            if (text) {
                yield { type: "text", content: text };
            }

            // Extract tool calls
            if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                    if ((part as any).functionCall) {
                        const fc = (part as any).functionCall;
                        yield {
                            type: "tool_call",
                            toolCall: {
                                name: fc.name,
                                args: fc.args as Record<string, any>,
                            },
                        };
                    }
                }
            }
        }
    }

    /**
     * Convert our Message format to Gemini's Content format
     */
    private convertMessagesToGemini(messages: Message[]): any[] {
        const contents: any[] = [];

        for (const message of messages) {
            if (message.role === "system") {
                // System messages are added as user messages in Gemini
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

                // Add text if present
                if (message.content) {
                    parts.push({ text: message.content });
                }

                // Add function calls if present
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
                // Tool results
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
    private convertToolToGemini(tool: ToolDefinition): any {
        return {
            functionDeclarations: [{
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            }],
        };
    }
}

/**
 * Core Agent implementation - orchestrates the Think -> Act -> Observe loop
 */

import { AgentConfig, AgentEvent, AgentResult, Message, ToolCall } from "./types";

export class Agent {
    private config: AgentConfig;
    private maxIterations: number;

    constructor(config: AgentConfig) {
        this.config = config;
        this.maxIterations = config.maxIterations || 10;
    }

    /**
     * Run the agent with a user message
     */
    async run(userMessage: string): Promise<AgentResult> {
        const allToolCalls: ToolCall[] = [];
        const allToolResults: any[] = [];
        let finalResponse = "";
        let iteration = 0;

        // Add user message to memory
        this.config.memory.addMessage({
            role: "user",
            content: userMessage,
        });

        while (iteration < this.maxIterations) {
            iteration++;

            // Get messages for this iteration
            const messages = this.prepareMessages();

            // Generate response from model
            const response = await this.config.modelAdapter.generate(
                messages,
                this.config.tools.getDefinitions()
            );

            // If there's text content, save it
            if (response.content) {
                finalResponse = response.content;
            }

            // If no tool calls, we're done
            if (!response.toolCalls || response.toolCalls.length === 0) {
                // Add assistant response to memory
                this.config.memory.addMessage({
                    role: "assistant",
                    content: response.content,
                });
                break;
            }

            // Execute tool calls
            const toolResults: any[] = [];
            for (const toolCall of response.toolCalls) {
                allToolCalls.push(toolCall);

                const result = await this.config.tools.execute(toolCall);
                toolResults.push(result);
                allToolResults.push(result);
            }

            // Add assistant message with tool calls
            this.config.memory.addMessage({
                role: "assistant",
                content: response.content,
                toolCalls: response.toolCalls,
            });

            // Add tool results as a separate message
            this.config.memory.addMessage({
                role: "tool",
                toolResults,
            });
        }

        return {
            finalResponse,
            toolCalls: allToolCalls,
            toolResults: allToolResults,
            iterations: iteration,
            messages: this.config.memory.getMessages(),
        };
    }

    /**
     * Run the agent with streaming
     */
    async *runStream(userMessage: string): AsyncGenerator<AgentEvent> {
        const allToolCalls: ToolCall[] = [];
        const allToolResults: any[] = [];
        let iteration = 0;

        // Add user message to memory
        this.config.memory.addMessage({
            role: "user",
            content: userMessage,
        });

        while (iteration < this.maxIterations) {
            iteration++;
            yield { type: "iteration", iteration, maxIterations: this.maxIterations };

            // Get messages for this iteration
            const messages = this.prepareMessages();

            // Stream response from model
            const stream = this.config.modelAdapter.generateStream(
                messages,
                this.config.tools.getDefinitions()
            );

            let currentResponseText = "";
            const currentToolCalls: ToolCall[] = [];

            for await (const chunk of stream) {
                if (chunk.type === "text" && chunk.content) {
                    currentResponseText += chunk.content;
                    yield { type: "thought", content: chunk.content };
                } else if (chunk.type === "tool_call" && chunk.toolCall) {
                    currentToolCalls.push(chunk.toolCall);
                    yield { type: "tool_call", toolCall: chunk.toolCall };
                }
            }

            // If no tool calls, we're done
            if (currentToolCalls.length === 0) {
                // Add assistant response to memory
                this.config.memory.addMessage({
                    role: "assistant",
                    content: currentResponseText,
                });
                yield { type: "response", content: currentResponseText };
                break;
            }

            // Execute tool calls
            const toolResults: any[] = [];
            for (const toolCall of currentToolCalls) {
                allToolCalls.push(toolCall);

                try {
                    const result = await this.config.tools.execute(toolCall);
                    toolResults.push(result);
                    allToolResults.push(result);
                    yield { type: "tool_result", toolResult: result };
                } catch (error) {
                    const errorResult = {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: error instanceof Error ? error.message : "Unknown error",
                        success: false,
                    };
                    toolResults.push(errorResult);
                    allToolResults.push(errorResult);
                    yield { type: "tool_result", toolResult: errorResult };
                }
            }

            // Add assistant message with tool calls
            this.config.memory.addMessage({
                role: "assistant",
                content: currentResponseText,
                toolCalls: currentToolCalls,
            });

            // Add tool results
            this.config.memory.addMessage({
                role: "tool",
                toolResults,
            });

            // Continue loop
        }

        yield { type: "done" };
    }

    /**
     * Prepare messages for the model, including system prompt
     */
    private prepareMessages(): Message[] {
        const messages: Message[] = [];

        // Add system prompt if available
        const systemPrompt = this.config.memory.getSystemPrompt();
        if (systemPrompt) {
            messages.push({
                role: "system",
                content: systemPrompt,
            });
        }

        // Add conversation history
        messages.push(...this.config.memory.getContextWindow(this.config.maxTokens));

        return messages;
    }

    /**
     * Reset the agent's memory
     */
    reset(): void {
        this.config.memory.clear();
    }

    /**
     * Get the current conversation history
     */
    getHistory(): Message[] {
        return this.config.memory.getMessages();
    }
}

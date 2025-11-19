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
        console.log("[AI Debug] Agent.run() - Starting execution");
        console.log("[AI Debug] User message:", userMessage.substring(0, 100) + (userMessage.length > 100 ? "..." : ""));
        
        const allToolCalls: ToolCall[] = [];
        const allToolResults: any[] = [];
        let finalResponse = "";
        let iteration = 0;

        // Add user message to memory
        this.config.memory.addMessage({
            role: "user",
            content: userMessage,
        });
        console.log("[AI Debug] Added user message to memory");

        while (iteration < this.maxIterations) {
            iteration++;
            console.log(`[AI Debug] === Iteration ${iteration}/${this.maxIterations} ===`);

            // Get messages for this iteration
            const messages = this.prepareMessages();
            console.log(`[AI Debug] Prepared ${messages.length} messages for model`);
            console.log(`[AI Debug] Available tools: ${this.config.tools.getDefinitions().length} tools`);

            // Generate response from model
            console.log("[AI Debug] Calling model adapter.generate()...");
            const startTime = Date.now();
            const response = await this.config.modelAdapter.generate(
                messages,
                this.config.tools.getDefinitions()
            );
            const duration = Date.now() - startTime;
            console.log(`[AI Debug] Model response received (${duration}ms)`);
            console.log(`[AI Debug] Response content length: ${response.content?.length || 0} chars`);
            console.log(`[AI Debug] Tool calls: ${response.toolCalls?.length || 0}`);
            if (response.toolCalls && response.toolCalls.length > 0) {
                console.log(`[AI Debug] Tool calls:`, response.toolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.args).substring(0, 50)}...)`));
            }

            // If there's text content, save it
            if (response.content) {
                finalResponse = response.content;
            }

            // If no tool calls, we're done
            if (!response.toolCalls || response.toolCalls.length === 0) {
                console.log("[AI Debug] No tool calls - completing execution");
                // Add assistant response to memory
                this.config.memory.addMessage({
                    role: "assistant",
                    content: response.content,
                });
                break;
            }

            // Execute tool calls
            console.log(`[AI Debug] Executing ${response.toolCalls.length} tool call(s)...`);
            const toolResults: any[] = [];
            for (const toolCall of response.toolCalls) {
                allToolCalls.push(toolCall);
                console.log(`[AI Debug] Executing tool: ${toolCall.name}`, toolCall.args);

                const toolStartTime = Date.now();
                const result = await this.config.tools.execute(toolCall);
                const toolDuration = Date.now() - toolStartTime;
                
                // Safely create result preview
                let resultPreview = "N/A";
                try {
                    if (result.result === undefined || result.result === null) {
                        resultPreview = String(result.result);
                    } else if (typeof result.result === 'string') {
                        resultPreview = result.result.substring(0, 100) + (result.result.length > 100 ? "..." : "");
                    } else {
                        const stringified = JSON.stringify(result.result);
                        resultPreview = stringified ? stringified.substring(0, 100) + (stringified.length > 100 ? "..." : "") : "Unable to stringify";
                    }
                } catch (e) {
                    resultPreview = `[Error stringifying result: ${e instanceof Error ? e.message : String(e)}]`;
                }
                
                console.log(`[AI Debug] Tool ${toolCall.name} completed (${toolDuration}ms)`, {
                    success: result.success,
                    error: result.error,
                    resultPreview
                });
                
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
            console.log(`[AI Debug] Iteration ${iteration} complete, continuing...`);
        }

        if (iteration >= this.maxIterations) {
            console.warn(`[AI Debug] Max iterations (${this.maxIterations}) reached`);
        }

        console.log(`[AI Debug] Agent.run() - Completed after ${iteration} iteration(s)`);
        console.log(`[AI Debug] Final response length: ${finalResponse.length} chars`);
        console.log(`[AI Debug] Total tool calls: ${allToolCalls.length}`);
        console.log(`[AI Debug] Total tool results: ${allToolResults.length}`);

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
        console.log("[AI Debug] Agent.runStream() - Starting streaming execution");
        console.log("[AI Debug] User message:", userMessage.substring(0, 100) + (userMessage.length > 100 ? "..." : ""));
        
        const allToolCalls: ToolCall[] = [];
        const allToolResults: any[] = [];
        let iteration = 0;

        // Add user message to memory
        this.config.memory.addMessage({
            role: "user",
            content: userMessage,
        });
        console.log("[AI Debug] Added user message to memory");

        while (iteration < this.maxIterations) {
            iteration++;
            console.log(`[AI Debug] === Iteration ${iteration}/${this.maxIterations} ===`);
            yield { type: "iteration", iteration, maxIterations: this.maxIterations };

            // Get messages for this iteration
            const messages = this.prepareMessages();
            console.log(`[AI Debug] Prepared ${messages.length} messages for model`);
            console.log(`[AI Debug] Available tools: ${this.config.tools.getDefinitions().length} tools`);

            // Stream response from model
            console.log("[AI Debug] Starting model adapter.generateStream()...");
            const streamStartTime = Date.now();
            const stream = this.config.modelAdapter.generateStream(
                messages,
                this.config.tools.getDefinitions()
            );

            let currentResponseText = "";
            const currentToolCalls: ToolCall[] = [];
            let chunkCount = 0;

            for await (const chunk of stream) {
                chunkCount++;
                if (chunk.type === "text" && chunk.content) {
                    currentResponseText += chunk.content;
                    yield { type: "thought", content: chunk.content };
                } else if (chunk.type === "tool_call" && chunk.toolCall) {
                    currentToolCalls.push(chunk.toolCall);
                    console.log(`[AI Debug] Received tool call chunk: ${chunk.toolCall.name}`);
                    yield { type: "tool_call", toolCall: chunk.toolCall };
                }
            }
            const streamDuration = Date.now() - streamStartTime;
            console.log(`[AI Debug] Stream completed (${streamDuration}ms, ${chunkCount} chunks)`);
            console.log(`[AI Debug] Response text length: ${currentResponseText.length} chars`);
            console.log(`[AI Debug] Tool calls received: ${currentToolCalls.length}`);

            // If no tool calls, we're done
            if (currentToolCalls.length === 0) {
                console.log("[AI Debug] No tool calls - completing execution");
                // Add assistant response to memory
                this.config.memory.addMessage({
                    role: "assistant",
                    content: currentResponseText,
                });
                yield { type: "response", content: currentResponseText };
                break;
            }

            // Execute tool calls
            console.log(`[AI Debug] Executing ${currentToolCalls.length} tool call(s)...`);
            const toolResults: any[] = [];
            for (const toolCall of currentToolCalls) {
                allToolCalls.push(toolCall);
                console.log(`[AI Debug] Executing tool: ${toolCall.name}`, toolCall.args);

                try {
                    const toolStartTime = Date.now();
                    const result = await this.config.tools.execute(toolCall);
                    const toolDuration = Date.now() - toolStartTime;
                    
                    // Safely create result preview
                    let resultPreview = "N/A";
                    try {
                        if (result.result === undefined || result.result === null) {
                            resultPreview = String(result.result);
                        } else if (typeof result.result === 'string') {
                            resultPreview = result.result.substring(0, 100) + (result.result.length > 100 ? "..." : "");
                        } else {
                            const stringified = JSON.stringify(result.result);
                            resultPreview = stringified ? stringified.substring(0, 100) + (stringified.length > 100 ? "..." : "") : "Unable to stringify";
                        }
                    } catch (e) {
                        resultPreview = `[Error stringifying result: ${e instanceof Error ? e.message : String(e)}]`;
                    }
                    
                    console.log(`[AI Debug] Tool ${toolCall.name} completed (${toolDuration}ms)`, {
                        success: result.success,
                        error: result.error,
                        resultPreview
                    });
                    toolResults.push(result);
                    allToolResults.push(result);
                    yield { type: "tool_result", toolResult: result };
                } catch (error) {
                    console.error(`[AI Debug] Tool ${toolCall.name} threw error:`, error);
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
            console.log(`[AI Debug] Iteration ${iteration} complete, continuing...`);

            // Continue loop
        }

        if (iteration >= this.maxIterations) {
            console.warn(`[AI Debug] Max iterations (${this.maxIterations}) reached`);
        }

        console.log(`[AI Debug] Agent.runStream() - Completed after ${iteration} iteration(s)`);
        console.log(`[AI Debug] Total tool calls: ${allToolCalls.length}`);
        console.log(`[AI Debug] Total tool results: ${allToolResults.length}`);
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

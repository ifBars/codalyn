/**
 * Conversation memory management
 */

import { Message, Memory } from "./types";

export class ConversationMemory implements Memory {
    private messages: Message[] = [];
    private systemPrompt?: string;

    constructor(systemPrompt?: string) {
        this.systemPrompt = systemPrompt;
    }

    addMessage(message: Message): void {
        this.messages.push({
            ...message,
            timestamp: message.timestamp || new Date(),
        });
    }

    getMessages(): Message[] {
        return [...this.messages];
    }

    getContextWindow(maxTokens?: number): Message[] {
        // Simple implementation: return all messages
        // TODO: Implement token counting and windowing
        return this.getMessages();
    }

    clear(): void {
        this.messages = [];
    }

    getSystemPrompt(): string | undefined {
        return this.systemPrompt;
    }

    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    /**
     * Get a summary of the conversation
     */
    getSummary(): string {
        return `Messages: ${this.messages.length}`;
    }

    /**
     * Export conversation to JSON
     */
    toJSON(): any {
        return {
            systemPrompt: this.systemPrompt,
            messages: this.messages,
        };
    }

    /**
     * Import conversation from JSON
     */
    static fromJSON(data: any): ConversationMemory {
        const memory = new ConversationMemory(data.systemPrompt);
        memory.messages = data.messages || [];
        return memory;
    }
}

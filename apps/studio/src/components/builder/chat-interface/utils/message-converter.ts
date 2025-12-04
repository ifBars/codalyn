import type { AIMessage, Message } from "@/lib/ai";

/**
 * Helper to convert AIMessage[] to Message[]
 */
export function convertAIMessagesToMessages(aiMessages: AIMessage[]): Message[] {
    return aiMessages.map((msg) => {
        if (msg.role === "user") {
            return {
                role: "user",
                content: msg.content,
            };
        } else {
            return {
                role: "assistant",
                content: msg.content,
            };
        }
    });
}


"use client";

import { useEffect, useRef, useState } from "react";
import type { AIMessage } from "@/lib/ai";

export function welcomeMessages(): AIMessage[] {
    return [
        {
            role: "assistant",
            content:
                "👋 Hi! I'm your AI frontend developer. Tell me what you want to build and I'll help you build it.",
        },
    ];
}

export function useMessages() {
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages(welcomeMessages());
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return {
        messages,
        setMessages,
        scrollRef,
    };
}


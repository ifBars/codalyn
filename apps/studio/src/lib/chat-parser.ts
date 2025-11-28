
export type ChatSectionType = 'thinking' | 'plan' | 'markdown';

export interface ChatSection {
    type: ChatSectionType;
    content: string;
}

export function parseChatContent(content: string): ChatSection[] {
    const sections: ChatSection[] = [];

    // Regex patterns
    const planStartPattern = /^Plan:?/mi;
    const planMatch = content.match(planStartPattern);

    // Heuristics for thinking
    // If the message starts with "Thinking Process:" or similar
    const thinkingStartPattern = /^(?:Thinking(?: Process)?|Thought(?:s)?):?/mi;
    const thinkingMatch = content.match(thinkingStartPattern);

    let remainingContent = content;
    let currentPos = 0;

    // 1. Check for Thinking at the start
    // Often the model just starts thinking without a header if it's the very first thing
    // But we want to be careful not to capture "Hi!" as thinking.

    // If we have an explicit thinking header
    if (thinkingMatch && thinkingMatch.index === 0) {
        // Find where thinking ends. Usually at "Plan:" or "Here is..." or just double newline after a long block?
        // Or maybe we just look for the next section header (Plan)

        let thinkingEndIndex = content.length;
        if (planMatch) {
            thinkingEndIndex = planMatch.index!;
        } else {
            // Look for other potential end markers if no plan
            // Be strict to avoid cutting off thinking prematurely
            const endMatch = content.match(/\n(?:FINAL OUTPUT|# )/i);
            if (endMatch) {
                thinkingEndIndex = endMatch.index!;
            }
        }

        const thinkingContent = content.substring(0, thinkingEndIndex).trim();
        if (thinkingContent) {
            sections.push({ type: 'thinking', content: thinkingContent });
        }

        remainingContent = content.substring(thinkingEndIndex);
        currentPos = thinkingEndIndex;
    }
    // If no explicit header, but looks like thinking (long, analytical, at start)
    // This is risky as it might capture the greeting.
    // Let's stick to the logic from markdown-content.tsx for identifying implicit thinking
    else {
        // We'll handle implicit thinking later or let it be markdown for now to be safe.
        // The user specifically mentioned "As the AI is streaming...", so maybe we can detect "streaming thinking".
    }

    // 2. Check for Plan
    // We need to re-match because we might have consumed some content
    const planMatchInRemaining = remainingContent.match(planStartPattern);

    if (planMatchInRemaining) {
        const planStartIndex = planMatchInRemaining.index!;

        // If there was content before the plan (and we didn't capture it as thinking), it's markdown
        if (planStartIndex > 0) {
            const prePlanContent = remainingContent.substring(0, planStartIndex).trim();
            if (prePlanContent) {
                sections.push({ type: 'markdown', content: prePlanContent });
            }
        }

        // Find end of plan
        // Look for "FINAL OUTPUT" or headers that look like the start of the actual response
        const afterPlan = remainingContent.substring(planStartIndex);
        const endMatch = afterPlan.match(/\n(?:FINAL OUTPUT|# |```)/i);

        let planEndIndex = afterPlan.length;
        if (endMatch && endMatch.index! > 0) { // Ensure we don't match the plan header itself
            planEndIndex = endMatch.index!;
        }

        const planContent = afterPlan.substring(0, planEndIndex).trim();
        if (planContent) {
            sections.push({ type: 'plan', content: planContent });
        }

        remainingContent = afterPlan.substring(planEndIndex);
    } else {
        // No plan found in remaining content
        // If we haven't added any sections yet, check for implicit thinking again?
        // Or just treat as markdown.
    }

    // 3. Add remaining as markdown
    if (remainingContent.trim()) {
        sections.push({ type: 'markdown', content: remainingContent.trim() });
    }

    // Post-processing:
    // If we have NO sections (empty content), return empty
    if (sections.length === 0 && content.trim()) {
        return [{ type: 'markdown', content: content }];
    }

    // If we only have markdown, try to extract implicit thinking if it looks like it
    if (sections.length === 1 && sections[0].type === 'markdown') {
        const text = sections[0].content;
        // Use heuristics from markdown-content.tsx
        // ...
        // For now, let's just return what we have.
    }

    return sections;
}

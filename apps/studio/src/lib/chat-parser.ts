// Cache for parsed content to avoid re-parsing unchanged sections during streaming
const parseCache = new Map<string, { sections: ChatSection[]; contentHash: string }>();

export type ChatSectionType = 'thinking' | 'plan' | 'markdown';

export interface ChatSection {
    type: ChatSectionType;
    content: string;
}

/**
 * Streaming-aware parser that handles incomplete content gracefully
 * Caches results to avoid re-parsing unchanged sections during streaming
 */
export function parseChatContent(content: string, isStreaming: boolean = false): ChatSection[] {
    // For streaming content, use a more lenient approach that handles incomplete sections
    if (isStreaming) {
        return parseChatContentStreaming(content);
    }

    // For complete content, use full parsing with caching
    const contentHash = content.substring(0, 100); // Quick hash for caching
    const cached = parseCache.get(contentHash);
    
    if (cached && cached.contentHash === content) {
        return cached.sections;
    }

    const sections = parseChatContentFull(content);
    
    // Cache result (limit cache size to prevent memory issues)
    if (parseCache.size > 50) {
        const firstKey = parseCache.keys().next().value;
        if (firstKey !== undefined) {
            parseCache.delete(firstKey);
        }
    }
    parseCache.set(contentHash, { sections, contentHash: content });
    
    return sections;
}

/**
 * Full parsing for complete content
 */
function parseChatContentFull(content: string): ChatSection[] {
    const sections: ChatSection[] = [];

    // Regex patterns
    const planStartPattern = /^Plan:?/mi;
    const planMatch = content.match(planStartPattern);

    // Heuristics for thinking
    const thinkingStartPattern = /^(?:Thinking(?: Process)?|Thought(?:s)?):?/mi;
    const thinkingMatch = content.match(thinkingStartPattern);

    let remainingContent = content;

    // 1. Check for Thinking at the start
    if (thinkingMatch && thinkingMatch.index === 0) {
        let thinkingEndIndex = content.length;
        if (planMatch) {
            thinkingEndIndex = planMatch.index!;
        } else {
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
    }

    // 2. Check for Plan
    const planMatchInRemaining = remainingContent.match(planStartPattern);

    if (planMatchInRemaining) {
        const planStartIndex = planMatchInRemaining.index!;

        // If there was content before the plan, it's markdown
        if (planStartIndex > 0) {
            const prePlanContent = remainingContent.substring(0, planStartIndex).trim();
            if (prePlanContent) {
                sections.push({ type: 'markdown', content: prePlanContent });
            }
        }

        // Find end of plan
        const afterPlan = remainingContent.substring(planStartIndex);
        const endMatch = afterPlan.match(/\n(?:FINAL OUTPUT|# |```)/i);

        let planEndIndex = afterPlan.length;
        if (endMatch && endMatch.index! > 0) {
            planEndIndex = endMatch.index!;
        }

        const planContent = afterPlan.substring(0, planEndIndex).trim();
        if (planContent) {
            sections.push({ type: 'plan', content: planContent });
        }

        remainingContent = afterPlan.substring(planEndIndex);
    }

    // 3. Add remaining as markdown
    if (remainingContent.trim()) {
        sections.push({ type: 'markdown', content: remainingContent.trim() });
    }

    // Post-processing: ensure we always return something for non-empty content
    if (sections.length === 0 && content.trim()) {
        return [{ type: 'markdown', content: content }];
    }

    return sections;
}

/**
 * Streaming-aware parser that handles incomplete content gracefully
 * More lenient with section boundaries during streaming
 */
function parseChatContentStreaming(content: string): ChatSection[] {
    const sections: ChatSection[] = [];

    // For streaming, be more lenient - don't require complete sections
    // Look for section markers but don't fail if content is incomplete

    const planStartPattern = /Plan:?/mi;
    const thinkingStartPattern = /(?:Thinking(?: Process)?|Thought(?:s)?):?/mi;
    
    const planMatch = content.match(planStartPattern);
    const thinkingMatch = content.match(thinkingStartPattern);

    // If we detect a thinking section at the start, extract it
    if (thinkingMatch && thinkingMatch.index === 0) {
        let thinkingEndIndex = content.length;
        
        // Look for plan marker
        if (planMatch && planMatch.index! > 0) {
            thinkingEndIndex = planMatch.index!;
        } else {
            // Look for other section markers
            const endMatch = content.match(/\n(?:FINAL OUTPUT|# |```|Plan:?)/i);
            if (endMatch && endMatch.index! > 10) { // Ensure we have some content
                thinkingEndIndex = endMatch.index!;
            }
        }

        const thinkingContent = content.substring(0, thinkingEndIndex).trim();
        if (thinkingContent.length > 20) { // Only add if substantial
            sections.push({ type: 'thinking', content: thinkingContent });
            content = content.substring(thinkingEndIndex);
        }
    }

    // Check for plan in remaining content
    const planMatchInRemaining = content.match(planStartPattern);
    if (planMatchInRemaining) {
        const planStartIndex = planMatchInRemaining.index!;
        
        // Add any content before plan as markdown
        if (planStartIndex > 0) {
            const prePlanContent = content.substring(0, planStartIndex).trim();
            if (prePlanContent) {
                sections.push({ type: 'markdown', content: prePlanContent });
            }
        }

        // Extract plan (be lenient with end detection during streaming)
        const afterPlan = content.substring(planStartIndex);
        const endMatch = afterPlan.match(/\n(?:FINAL OUTPUT|# |```)/i);
        
        let planEndIndex = afterPlan.length;
        if (endMatch && endMatch.index! > 10) {
            planEndIndex = endMatch.index!;
        }

        const planContent = afterPlan.substring(0, planEndIndex).trim();
        if (planContent.length > 10) {
            sections.push({ type: 'plan', content: planContent });
        }
        content = afterPlan.substring(planEndIndex);
    }

    // Add remaining content as markdown (even if incomplete)
    if (content.trim()) {
        sections.push({ type: 'markdown', content: content.trim() });
    }

    // Ensure we return at least one section
    if (sections.length === 0) {
        return [{ type: 'markdown', content: content || '' }];
    }

    return sections;
}

"use client";

import type { Artifact } from "@codalyn/accuralai";

/**
 * Plan mention format: @plan-name or @[plan-id]
 * We'll use @plan-name format where plan-name is the sanitized filename
 */

export interface PlanMention {
    /** The full mention text (e.g., "@plan-name") */
    mention: string;
    /** The plan identifier (filename or ID) */
    identifier: string;
    /** Start position in the text */
    startIndex: number;
    /** End position in the text */
    endIndex: number;
}

/**
 * Sanitize a plan filename to create a mention-friendly identifier
 * Replaces spaces with hyphens, removes special chars, lowercase
 */
export function sanitizePlanName(filename: string): string {
    return filename
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Create a mention string from a plan
 */
export function createPlanMention(plan: Artifact): string {
    const sanitized = sanitizePlanName(plan.filename);
    return `@${sanitized}`;
}

/**
 * Parse all plan mentions from a text string
 * Supports both @plan-name and @[plan-id] formats
 */
export function parsePlanMentions(text: string): PlanMention[] {
    const mentions: PlanMention[] = [];
    
    // Match @plan-name format (word characters and hyphens)
    const simpleMentionRegex = /@([a-z0-9-]+)/gi;
    let match;
    
    while ((match = simpleMentionRegex.exec(text)) !== null) {
        mentions.push({
            mention: match[0],
            identifier: match[1],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }
    
    // Match @[plan-id] format (explicit ID references)
    const idMentionRegex = /@\[([^\]]+)\]/gi;
    while ((match = idMentionRegex.exec(text)) !== null) {
        mentions.push({
            mention: match[0],
            identifier: match[1],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }
    
    return mentions;
}

/**
 * Find a plan by mention identifier (filename or ID)
 */
export function findPlanByMention(
    plans: Artifact[],
    identifier: string
): Artifact | undefined {
    // First try to match by sanitized filename
    const sanitizedIdentifier = identifier.toLowerCase();
    let plan = plans.find(
        (p) => sanitizePlanName(p.filename) === sanitizedIdentifier
    );
    
    // If not found, try matching by ID
    if (!plan) {
        plan = plans.find((p) => p.id === identifier);
    }
    
    // If still not found, try partial filename match
    if (!plan) {
        plan = plans.find((p) =>
            sanitizePlanName(p.filename).includes(sanitizedIdentifier)
        );
    }
    
    return plan;
}

/**
 * Get preview of plan content (first N lines)
 */
function getPlanPreview(content: string, maxLines: number = 100): string {
    const lines = content.split("\n");
    const previewLines = lines.slice(0, maxLines);
    const preview = previewLines.join("\n");
    
    if (lines.length > maxLines) {
        return preview + `\n\n... (${lines.length - maxLines} more lines - use read_file tool to view full content)`;
    }
    
    return preview;
}

/**
 * Expand plan mentions in a message to include plan preview as context
 * Returns the expanded message with plan previews appended
 * Note: The AI should use read_file tool to read the full plan content when needed
 */
export function expandPlanMentions(
    message: string,
    plans: Artifact[]
): { expandedMessage: string; referencedPlans: Artifact[] } {
    const mentions = parsePlanMentions(message);
    const referencedPlans: Artifact[] = [];
    const planMap = new Map<string, Artifact>();
    
    // Find all referenced plans
    for (const mention of mentions) {
        const plan = findPlanByMention(plans, mention.identifier);
        if (plan && !planMap.has(plan.id)) {
            planMap.set(plan.id, plan);
            referencedPlans.push(plan);
        }
    }
    
    // If no plans referenced, return original message
    if (referencedPlans.length === 0) {
        return { expandedMessage: message, referencedPlans: [] };
    }
    
    // Build context string with plan previews (first 100 lines)
    const planContexts = referencedPlans.map((plan) => {
        const planTitle = plan.filename.replace(/\.md$/, "");
        const planPath = plan.path || `plans/${plan.filename}`;
        const preview = getPlanPreview(plan.content, 100);
        
        return `\n\n---\nPlan Reference: @${sanitizePlanName(plan.filename)}\nTitle: ${planTitle}\nPath: ${planPath}\n${plan.metadata?.description ? `Description: ${plan.metadata.description}\n` : ""}Preview (first 100 lines):\n${preview}\n\nNote: Use the read_file tool with path "${planPath}" to read the full plan content.`;
    });
    
    const expandedMessage = message + planContexts.join("\n\n---\n");
    
    return { expandedMessage, referencedPlans };
}

/**
 * Get the current mention being typed (if any)
 * Returns the text after @ up to cursor position
 */
export function getCurrentMention(
    text: string,
    cursorPosition: number
): { query: string; startIndex: number } | null {
    // Find the last @ before cursor
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    
    if (lastAt === -1) {
        return null;
    }
    
    // Check if there's a space or newline between @ and cursor (invalid mention)
    const textAfterAt = textBeforeCursor.substring(lastAt + 1);
    if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
        return null;
    }
    
    // Extract the query (text after @)
    const query = textAfterAt.trim();
    
    return {
        query,
        startIndex: lastAt,
    };
}

/**
 * Filter plans based on a search query
 */
export function filterPlansByQuery(
    plans: Artifact[],
    query: string
): Artifact[] {
    if (!query) {
        return plans.slice(0, 8); // Return first 8 if no query
    }
    
    const lowerQuery = query.toLowerCase();
    const sanitizedQuery = sanitizePlanName(query);
    
    return plans
        .filter((plan) => {
            const sanitizedFilename = sanitizePlanName(plan.filename);
            const lowerFilename = plan.filename.toLowerCase();
            const description = plan.metadata?.description?.toLowerCase() || "";
            
            return (
                sanitizedFilename.includes(sanitizedQuery) ||
                lowerFilename.includes(lowerQuery) ||
                description.includes(lowerQuery)
            );
        })
        .slice(0, 8); // Limit to 8 results
}


"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { FileText, Package, Trash2, Brain, ListChecks, ChevronDown, ChevronUp } from "lucide-react";
import type { FileOperation } from "@/lib/ai";

interface MarkdownContentProps {
  content: string;
  className?: string;
  operations?: FileOperation[];
}

/**
 * Action card component for displaying inline operation indicators
 */
function ActionCard({ 
  icon: Icon, 
  label, 
  detail,
  variant = "default"
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  detail?: string;
  variant?: "default" | "thinking" | "plan";
}) {
  const variantStyles = {
    default: "border-border/50 bg-muted/30",
    thinking: "border-primary/30 bg-primary/5",
    plan: "border-blue-500/30 bg-blue-500/5",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${variantStyles[variant]}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${variant === "plan" ? "text-blue-500" : variant === "thinking" ? "text-primary" : "text-primary"}`} />
      <span className="font-medium text-foreground/90">{label}</span>
      {detail && (
        <span className="truncate text-muted-foreground max-w-[200px]">{detail}</span>
      )}
    </div>
  );
}

/**
 * Thinking card component with collapsible content and timing display
 */
function ThinkingCard({ 
  content,
  timing,
  isActive = true
}: { 
  content: string;
  timing?: string;
  isActive?: boolean; // Whether thinking is still active (stops timer when false)
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const startTimeRef = React.useRef<number | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastContentLengthRef = React.useRef(0);
  const lastUpdateTimeRef = React.useRef<number | null>(null);
  const isStoppedRef = React.useRef(false);

  // Track when content starts streaming (when it first appears or grows)
  React.useEffect(() => {
    const hasContent = content.length > 0;
    const isContentGrowing = content.length > lastContentLengthRef.current;
    const isNewContent = hasContent && lastContentLengthRef.current === 0;
    
    // Start tracking time when content first appears
    if (isNewContent) {
      startTimeRef.current = Date.now();
      lastUpdateTimeRef.current = Date.now();
      setElapsedSeconds(0);
      lastContentLengthRef.current = content.length;
      isStoppedRef.current = false;
    } 
    // Continue tracking if content is still growing (streaming)
    else if (isContentGrowing && startTimeRef.current !== null && !isStoppedRef.current) {
      lastContentLengthRef.current = content.length;
      lastUpdateTimeRef.current = Date.now();
    }
    // If content shrinks significantly, it might be a new section - reset
    else if (content.length < lastContentLengthRef.current * 0.5 && content.length > 0) {
      startTimeRef.current = Date.now();
      lastUpdateTimeRef.current = Date.now();
      setElapsedSeconds(0);
      lastContentLengthRef.current = content.length;
      isStoppedRef.current = false;
    }
  }, [content]);

  // Stop timer when thinking ends (tool calls happened or content stopped growing)
  React.useEffect(() => {
    if (!isActive && startTimeRef.current !== null && !isStoppedRef.current) {
      // Calculate final elapsed time
      const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(finalElapsed);
      isStoppedRef.current = true;
      
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isActive]);

  // Detect when content stops growing (thinking ended naturally)
  React.useEffect(() => {
    if (!isActive || isStoppedRef.current || startTimeRef.current === null) return;

    const checkIfStopped = () => {
      // If content hasn't updated in 2 seconds, stop the timer
      if (lastUpdateTimeRef.current !== null) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate > 2000 && !isStoppedRef.current) {
          const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(finalElapsed);
          isStoppedRef.current = true;
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    };

    const timeoutId = setTimeout(checkIfStopped, 2100); // Check after 2.1 seconds
    return () => clearTimeout(timeoutId);
  }, [content.length, isActive]);

  // Update elapsed time every 100ms while we have content and thinking is active
  React.useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (startTimeRef.current === null || content.length === 0 || !isActive || isStoppedRef.current) {
      return;
    }

    // Update immediately
    const updateElapsed = () => {
      if (startTimeRef.current === null || isStoppedRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();

    // Set up interval to update every 100ms for smooth updates
    intervalRef.current = setInterval(updateElapsed, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [content.length, isActive]); // Re-run when content length changes or active status changes

  // Format timing display
  const formatTiming = (seconds: number): string => {
    if (seconds < 1) return "<1s";
    if (seconds === 1) return "1s";
    return `${seconds}s`;
  };

  const displayTiming = timing || formatTiming(elapsedSeconds);

  return (
    <div className="my-2 rounded border border-border/30 bg-[#1e1e1e] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground/80 hover:bg-foreground/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-foreground/50" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-foreground/50" />
        )}
        <span>Thought for {displayTiming}</span>
      </button>
      {isExpanded && (
        <div className="border-t border-border/20 max-h-[400px] overflow-y-auto">
          <div className="px-3 py-2.5 text-xs text-foreground/70 font-mono whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Parse markdown content to identify sections
 */
function parseContentSections(content: string): {
  hasPlan: boolean;
  planStartIndex: number;
  planEndIndex: number;
  thinkingSections: Array<{ start: number; end: number; text: string }>;
} {
  // Look for "Plan:" or "Plan" at start of line (case insensitive)
  const planPattern = /^Plan:?\s*$/mi;
  const planMatch = content.match(planPattern);
  const planStartIndex = planMatch ? planMatch.index! : -1;
  
  let planEndIndex = -1;
  if (planStartIndex >= 0) {
    // Find where plan ends (look for "FINAL OUTPUT:", "Next:", "Starting", or section markers)
    const afterPlan = content.substring(planStartIndex);
    const finalOutputMatch = afterPlan.match(/\n(?:FINAL OUTPUT|Next|Starting|I have|I will|The (?:site|component|page|visual changes))/mi);
    planEndIndex = finalOutputMatch 
      ? planStartIndex + finalOutputMatch.index! 
      : content.length;
  }

  // Identify thinking sections (text blocks that aren't plans, final outputs, or welcome messages)
  const thinkingSections: Array<{ start: number; end: number; text: string }> = [];
  const sections = content.split(/\n\n+/);
  let currentIndex = 0;
  
  // Patterns that indicate non-thinking content (welcome messages, greetings, final summaries, etc.)
  const nonThinkingPatterns = [
    /^(?:👋|Hi!|Hello|Hey)/i, // Greetings
    /^I'm your/i, // Introductions
    /^Tell me what/i, // Prompts to user
    /^(?:FINAL OUTPUT|I have completed|The (?:site|component|page) now)/i, // Final outputs
    /^(?:Plan|#|##|###)/i, // Plans and headings
    /^(?:Summary|In summary|To summarize|Final summary|To sum up|In conclusion)/i, // Final summaries
  ];
  
  // Patterns that indicate summary content (even if not at start)
  const summaryPatterns = [
    /\b(?:summary|summarize|summarizing|in summary|to summarize|final summary|to sum up|in conclusion|conclusion)\b/i,
  ];
  
  for (const section of sections) {
    const sectionStart = currentIndex;
    const sectionEnd = currentIndex + section.length;
    const trimmedSection = section.trim();
    
    // Skip if it's a plan section
    if (planStartIndex >= 0 && sectionStart >= planStartIndex && sectionEnd <= planEndIndex) {
      currentIndex = sectionEnd + 2; // +2 for \n\n
      continue;
    }
    
    // Skip if it matches non-thinking patterns (welcome messages, greetings, summaries, etc.)
    const isNonThinking = nonThinkingPatterns.some(pattern => pattern.test(trimmedSection));
    if (isNonThinking) {
      currentIndex = sectionEnd + 2;
      continue;
    }
    
    // Check if this section is a final summary
    const contentLength = content.length;
    const isNearEnd = sectionStart > contentLength * 0.7;
    const hasSummaryLanguage = summaryPatterns.some(pattern => pattern.test(trimmedSection));
    
    // Patterns that indicate completed work (past tense, summary of actions taken)
    // More specific patterns to avoid false positives with thinking language
    const completedWorkPatterns = [
      /\b(?:I've (?:completed|created|updated|added|removed|modified|implemented|fixed|changed|finished))\b/i,
      /\b(?:I have (?:completed|created|updated|added|removed|modified|implemented|fixed|changed|finished))\b/i,
      /\b(?:completed|created|updated|added|removed|modified|implemented|fixed|changed|finished) (?:the|a|an|your)\b/i,
      /\b(?:The (?:component|page|site|feature) (?:is|has been) (?:now|complete|ready|updated|created))\b/i,
    ];
    const describesCompletedWork = completedWorkPatterns.some(pattern => pattern.test(trimmedSection));
    
    // Skip if it's a final summary (near end + summary language) or describes completed work
    if ((isNearEnd && hasSummaryLanguage) || (isNearEnd && describesCompletedWork)) {
      currentIndex = sectionEnd + 2;
      continue;
    }
    
    // Skip very short sections (likely not substantial thinking)
    if (trimmedSection.length < 100) {
      currentIndex = sectionEnd + 2;
      continue;
    }
    
    // Only consider it a thinking section if:
    // 1. It's substantial text (at least 100 chars)
    // 2. It doesn't match non-thinking patterns
    // 3. It's not a plan or final output
    // 4. It's not a final summary
    // 5. It contains descriptive/analytical language (indicates actual thinking)
    const hasAnalyticalLanguage = /\b(?:I have|I will|I need to|Let me|This|The|analyzing|considering|thinking|planning|deciding)\b/i.test(trimmedSection);
    
    if (hasAnalyticalLanguage && trimmedSection.length >= 100) {
      thinkingSections.push({
        start: sectionStart,
        end: sectionEnd,
        text: trimmedSection.substring(0, 100) + (trimmedSection.length > 100 ? "..." : ""),
      });
    }
    
    currentIndex = sectionEnd + 2;
  }

  return {
    hasPlan: planStartIndex >= 0,
    planStartIndex,
    planEndIndex,
    thinkingSections,
  };
}

/**
 * Renders markdown content with proper styling for AI responses
 * Injects inline action cards for file operations, plans, and thinking sections
 */
export function MarkdownContent({ content, className = "", operations = [] }: MarkdownContentProps) {
  // Parse content to identify sections
  const contentSections = React.useMemo(() => parseContentSections(content), [content]);

  // Filter out thinking sections from the content that will be rendered
  const filteredContent = React.useMemo(() => {
    if (contentSections.thinkingSections.length === 0) return content;
    
    // Build filtered content by keeping everything except thinking sections
    // Sort sections by start index to process them in order
    const sectionsToRemove = [...contentSections.thinkingSections].sort((a, b) => a.start - b.start);
    
    let filtered = '';
    let lastIndex = 0;
    
    for (const section of sectionsToRemove) {
      // Add content before this thinking section
      filtered += content.substring(lastIndex, section.start);
      lastIndex = section.end;
    }
    
    // Add remaining content after the last thinking section
    filtered += content.substring(lastIndex);
    
    // Clean up multiple consecutive newlines that might result from removal
    filtered = filtered.replace(/\n\n\n+/g, '\n\n');
    
    return filtered.trim();
  }, [content, contentSections]);

  // Deduplicate operations by path/type to prevent duplicate cards
  const uniqueOperations = React.useMemo(() => {
    const seen = new Set<string>();
    return operations.filter((op) => {
      const key = `${op.type}-${op.path || op.packages?.join(',') || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [operations]);

  // Generate tool operation action cards (return array of cards, not wrapped)
  const toolActionCards = React.useMemo(() => {
    if (uniqueOperations.length === 0) return null;

    const cards: JSX.Element[] = [];
    
    uniqueOperations.forEach((op, idx) => {
      if (op.type === "write" && op.path) {
        cards.push(
          <ActionCard
            key={`write-${op.path}-${idx}`}
            icon={FileText}
            label="Writing file"
            detail={op.path}
            variant="default"
          />
        );
      } else if (op.type === "delete" && op.path) {
        cards.push(
          <ActionCard
            key={`delete-${op.path}-${idx}`}
            icon={Trash2}
            label="Deleting file"
            detail={op.path}
            variant="default"
          />
        );
      } else if (op.type === "install_package" && op.packages && op.packages.length > 0) {
        cards.push(
          <ActionCard
            key={`install-${op.packages.join(',')}-${idx}`}
            icon={Package}
            label="Installing packages"
            detail={op.packages.join(", ")}
            variant="default"
          />
        );
      }
    });

    return cards.length > 0 ? cards : null;
  }, [uniqueOperations]);

  // Generate plan action card
  const planCard = React.useMemo(() => {
    if (!contentSections.hasPlan) return null;
    
    const planText = content.substring(
      contentSections.planStartIndex,
      Math.min(contentSections.planStartIndex + 200, contentSections.planEndIndex)
    ).trim();
    
    return (
      <div className="my-2 flex flex-wrap items-center gap-2">
        <ActionCard
          icon={ListChecks}
          label="Planning"
          detail={planText.split('\n')[0]?.substring(0, 50) + "..."}
          variant="plan"
        />
      </div>
    );
  }, [content, contentSections]);

  // Generate thinking action cards
  const thinkingCards = React.useMemo(() => {
    if (contentSections.thinkingSections.length === 0) return null;
    
    // Only show first thinking section as a card
    const firstThinking = contentSections.thinkingSections[0];
    const fullThinkingText = content.substring(firstThinking.start, firstThinking.end);
    
    // Thinking is active if no operations have occurred yet (no tool calls)
    // Once tool calls happen, thinking phase has ended
    const isThinkingActive = uniqueOperations.length === 0;
    
    return (
      <ThinkingCard
        content={fullThinkingText}
        isActive={isThinkingActive}
      />
    );
  }, [content, contentSections, uniqueOperations.length]);

  // Create a stable key for this content/operations combination
  const contentKey = React.useMemo(() => {
    return `${content.substring(0, 100)}-${uniqueOperations.map(op => `${op.type}-${op.path || op.packages?.join(',')}`).join('|')}`;
  }, [content, uniqueOperations]);

  // Track insertion using a ref keyed by contentKey to prevent duplicates
  const insertionRef = React.useRef<string | null>(null);
  const paragraphIndexRef = React.useRef(0);

  // Reset insertion state when contentKey changes
  React.useEffect(() => {
    insertionRef.current = null;
    paragraphIndexRef.current = 0;
  }, [contentKey]);

  const components: Components = React.useMemo(() => {
    // Reset paragraph index at start of render for this content
    paragraphIndexRef.current = 0;
    
    return {
      // Headings
      h1: ({ children }) => (
        <h1 className="mb-1.5 mt-3 text-sm font-bold first:mt-0">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="mb-1 mt-2 text-xs font-semibold first:mt-0">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mb-1 mt-2 text-xs font-semibold first:mt-0">{children}</h3>
      ),
      // Paragraphs - inject action cards strategically after first paragraph only
      p: ({ children, ...props }) => {
        const currentIndex = paragraphIndexRef.current;
        paragraphIndexRef.current += 1;
        
        const wasInserted = insertionRef.current === contentKey;
        const shouldInsertCards = currentIndex === 0 && !wasInserted && (planCard || thinkingCards || toolActionCards);
        
        if (shouldInsertCards) {
          // Mark as inserted immediately to prevent duplicates
          insertionRef.current = contentKey;
          
          return (
            <>
              <p className="mb-1.5 last:mb-0 leading-relaxed" {...props}>{children}</p>
              {thinkingCards}
              {(planCard || toolActionCards) && (
                <div className="my-2 flex flex-wrap items-center gap-2">
                  {planCard}
                  {toolActionCards && (
                    <>
                      {toolActionCards}
                    </>
                  )}
                </div>
              )}
            </>
          );
        }
        
        return (
          <p className="mb-1.5 last:mb-0 leading-relaxed" {...props}>{children}</p>
        );
      },
    // Lists - support nested lists
    ul: ({ children }) => (
      <ul className="mb-1.5 ml-4 list-disc space-y-0.5 last:mb-0 [&_ul]:mt-1 [&_ul]:ml-4 [&_ul]:list-[circle] [&_ul_ul]:list-[square]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-1.5 ml-4 list-decimal space-y-0.5 last:mb-0 [&_ol]:mt-1 [&_ol]:ml-4 [&_ol]:list-[lower-alpha] [&_ol_ol]:list-[lower-roman]">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed [&>p]:mb-1 [&>p]:last:mb-0">{children}</li>
    ),
    // Tables
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-border text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-muted/30">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-border/30 last:border-0">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-medium text-foreground/80">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-foreground/70">{children}</td>
    ),
    // Images
    img: ({ src, alt, ...props }) => (
      <img
        src={src}
        alt={alt}
        className="my-4 max-w-full rounded-lg border border-border"
        {...props}
      />
    ),
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="mb-2 border-l-2 border-border/50 pl-3 italic last:mb-0">
        {children}
      </blockquote>
    ),
    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80"
      >
        {children}
      </a>
    ),
    // Strong/Bold
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    // Emphasis/Italic
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),
      // Horizontal rule
      hr: () => (
        <hr className="my-3 border-border/50" />
      ),
    };
  }, [planCard, thinkingCards, toolActionCards, contentKey]);

  // Fallback: if no paragraphs exist, show cards at the top
  // Check if content has paragraphs (double newline indicates paragraph break)
  const hasParagraphs = content.includes('\n\n') || content.split('\n').length > 2;
  const shouldShowCardsAtTop = !hasParagraphs && (planCard || thinkingCards || toolActionCards);

  return (
    <div className={`markdown-content ${className}`}>
      {shouldShowCardsAtTop && (
        <>
          {thinkingCards}
          {(planCard || toolActionCards) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {planCard}
              {toolActionCards && (
                <>
                  {toolActionCards}
                </>
              )}
            </div>
          )}
        </>
      )}
      <ReactMarkdown key={contentKey} components={components}>{filteredContent}</ReactMarkdown>
    </div>
  );
}


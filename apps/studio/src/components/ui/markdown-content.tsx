"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { FileText, Package, Trash2 } from "lucide-react";
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
  variant?: "default";
}) {
  const variantStyles = {
    default: "border-border/50 bg-muted/30",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${variantStyles[variant]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-medium text-foreground/90">{label}</span>
      {detail && (
        <span className="truncate text-muted-foreground max-w-[200px]">{detail}</span>
      )}
    </div>
  );
}

/**
 * Renders markdown content with proper styling for AI responses
 * Injects inline action cards for file operations
 */
export function MarkdownContent({ content, className = "", operations = [] }: MarkdownContentProps) {
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
        const shouldInsertCards = currentIndex === 0 && !wasInserted && toolActionCards;

        if (shouldInsertCards) {
          // Mark as inserted immediately to prevent duplicates
          insertionRef.current = contentKey;

          return (
            <>
              <p className="mb-1.5 last:mb-0 leading-relaxed" {...props}>{children}</p>
              {toolActionCards && (
                <div className="my-2 flex flex-wrap items-center gap-2">
                  {toolActionCards}
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
  }, [toolActionCards, contentKey]);

  // Fallback: if no paragraphs exist, show cards at the top
  const hasParagraphs = content.includes('\n\n') || content.split('\n').length > 2;
  const shouldShowCardsAtTop = !hasParagraphs && toolActionCards;

  return (
    <div className={`markdown-content ${className}`}>
      {shouldShowCardsAtTop && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {toolActionCards}
        </div>
      )}
      <ReactMarkdown key={contentKey} components={components}>{content}</ReactMarkdown>
    </div>
  );
}

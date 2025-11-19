"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with proper styling for AI responses
 */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const components: Components = {
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
    // Paragraphs
    p: ({ children }) => (
      <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
    ),
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
    // Code blocks
    code: ({ inline, children }) => {
      if (inline) {
        return (
          <code className="rounded bg-background/50 px-1 py-0.5 text-[0.9em] font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className="block rounded bg-background/50 p-2 text-[0.9em] font-mono overflow-x-auto">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mb-2 overflow-x-auto rounded bg-background/50 p-2 text-[0.9em] last:mb-0">
        {children}
      </pre>
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

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}


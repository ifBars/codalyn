/**
 * Response filtering utilities
 * Prevents code from being output directly in text responses
 */

/**
 * Filter out random code blocks and irrelevant content from LLM responses
 */
export function filterResponseText(text: string): string {
  if (!text) return text;

  let filtered = text;

  // Remove "File content:" headers followed by code blocks
  filtered = filtered.replace(/File content:\s*\n\s*```[\s\S]*?```/gi, '');

  // Remove large code blocks that look like complete files (not snippets)
  // Pattern: code blocks with imports/exports and many lines
  filtered = filtered.replace(/```[\w]*\n([\s\S]*?)```/g, (match, content) => {
    const lineCount = content.split('\n').length;
    const hasImports = /import\s+.*from/.test(content);
    const hasExports = /export\s+(default\s+)?(const|function|class|interface|type)/.test(content);
    const isLargeFile = lineCount > 30 && content.length > 500;

    // Remove if it looks like a complete file dump
    if (isLargeFile && (hasImports || hasExports)) {
      return '';
    }

    return match;
  });

  // Remove "File content:" lines followed by large code blocks (without markdown)
  filtered = filtered.replace(/File content:\s*\n([\s\S]{300,}?)(?=\n\n|\n[A-Z]|$)/g, '');

  // Remove standalone code lines (like "export default App;")
  // Pattern: lines that look like code statements without context
  filtered = filtered.replace(/^(export\s+(default\s+)?[\w]+\s*;?\s*)$/gm, '');
  filtered = filtered.replace(/^(import\s+.*from\s+['"].*['"]\s*;?\s*)$/gm, '');
  filtered = filtered.replace(/^(const\s+\w+\s*=.*;?\s*)$/gm, '');
  filtered = filtered.replace(/^(function\s+\w+.*\{?\s*)$/gm, '');

  // Clean up multiple consecutive newlines
  filtered = filtered.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace
  filtered = filtered.trim();

  return filtered;
}

/**
 * Check if text response contains code without tool calls
 * Returns true if code is detected and should be rejected
 */
export function containsCodeWithoutTools(text: string, hasToolCalls: boolean): boolean {
  if (!text || hasToolCalls) return false;

  // Check for code patterns
  const codePatterns = [
    /^export\s+(default\s+)?[\w]+\s*;?\s*$/m,  // "export default App;"
    /^import\s+.*from\s+['"].*['"]\s*;?\s*$/m,  // import statements
    /^const\s+\w+\s*=.*;?\s*$/m,  // const declarations
    /^function\s+\w+.*\{?\s*$/m,  // function declarations
    /^class\s+\w+.*\{?\s*$/m,  // class declarations
    /```[\w]*\n[\s\S]*?```/,  // code blocks
  ];

  return codePatterns.some(pattern => pattern.test(text.trim()));
}


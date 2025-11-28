/**
 * Simple regex-based tokenizer for estimating token counts.
 */

import type { GenerateRequest, GenerateResponse } from '../contracts/models';

export interface Tokenizer {
  countRequestTokens(request: GenerateRequest): number;
  countResponseTokens(response: GenerateResponse): number;
  countText(text: string): number;
}

export function createDefaultTokenizer(): Tokenizer {
  // Simple word-based approximation (4 chars ≈ 1 token)
  const countText = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  return {
    countRequestTokens(request: GenerateRequest): number {
      let total = countText(request.prompt);
      if (request.systemPrompt) total += countText(request.systemPrompt);
      for (const msg of request.history) {
        if (msg.content) total += countText(String(msg.content));
      }
      return total;
    },

    countResponseTokens(response: GenerateResponse): number {
      return countText(response.outputText);
    },

    countText,
  };
}

export const DEFAULT_TOKENIZER = createDefaultTokenizer();

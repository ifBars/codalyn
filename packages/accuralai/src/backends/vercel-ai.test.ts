import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRequest } from '../contracts/models';
import { VercelAIBackend } from './vercel-ai';

const generateTextMock = vi.fn();

vi.mock('ai', () => ({
  generateText: (args: unknown) => generateTextMock(args),
  createProviderRegistry: (providers: Record<string, unknown>, options: { separator: string }) => ({
    languageModel(modelId: string) {
      return { modelId, providers, separator: options.separator };
    },
  }),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: { providerId: 'openai-default' },
  createOpenAI: (options: unknown) => ({ providerId: 'openai-created', options }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: { providerId: 'anthropic-default' },
  createAnthropic: (options: unknown) => ({ providerId: 'anthropic-created', options }),
}));

vi.mock('@ai-sdk/google', () => ({
  google: { providerId: 'google-default' },
}));

vi.mock('ollama-ai-provider-v2', () => ({
  ollama: { providerId: 'ollama-default' },
  createOllama: (options: unknown) => ({ providerId: 'ollama-created', options }),
}));

describe('VercelAIBackend', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it('routes through registry and maps response fields', async () => {
    const backend = new VercelAIBackend({
      defaultModel: 'openai:gpt-4o',
      separator: ':',
      openai: { apiKey: 'abc' },
    });

    const request = createRequest({
      prompt: 'Hello world',
      systemPrompt: 'You are helpful',
      history: [{ role: 'assistant', content: 'previous' }],
      parameters: { model: 'anthropic:claude-3-haiku', temperature: 0.1 },
    });

    generateTextMock.mockResolvedValue({
      text: 'reply',
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
      raw: { id: 'ai-response' },
    });

    const response = await backend.generate(request, { routedTo: 'route-1' });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const callArgs = generateTextMock.mock.calls[0][0] as any;
    expect(callArgs.model.modelId).toBe('anthropic:claude-3-haiku');
    expect(callArgs.messages).toEqual([
      { role: 'system', content: 'You are helpful' },
      { role: 'assistant', content: 'previous' },
      { role: 'user', content: 'Hello world' },
    ]);

    expect(response.outputText).toBe('reply');
    expect(response.finishReason).toBe('stop');
    expect(response.usage).toEqual({
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      extra: {},
    });
    expect(response.metadata).toMatchObject({
      backend: 'vercel-ai',
      model: 'anthropic:claude-3-haiku',
      provider: 'anthropic',
      routedTo: 'route-1',
    });
  });

  it('prefixes model with default provider and returns error metadata on failure', async () => {
    const backend = new VercelAIBackend({
      defaultModel: 'openai:gpt-4o-mini',
      separator: ':',
    });

    const request = createRequest({
      prompt: 'Test prompt',
      parameters: { model: 'gpt-4o-mini' },
    });

    generateTextMock.mockRejectedValue(new Error('boom'));

    const response = await backend.generate(request, { routedTo: 'route-2' });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect((generateTextMock.mock.calls[0][0] as any).model.modelId).toBe('openai:gpt-4o-mini');
    expect(response.finishReason).toBe('error');
    expect(response.metadata?.error).toBe('boom');
  });
});

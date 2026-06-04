// Model context window sizes (tokens)
// Maps model ID patterns to their context window sizes

const CONTEXT_WINDOWS: Record<string, number> = {
  // Claude
  "claude-sonnet-4": 200_000,
  "claude-opus-4": 200_000,
  "claude-haiku-4": 200_000,
  "claude-3-5-sonnet": 200_000,
  "claude-3-5-haiku": 200_000,
  "claude-3-opus": 200_000,
  "claude-sonnet-4.5": 200_000,
  "claude-sonnet-4.6": 200_000,
  "claude-opus-4.6": 200_000,
  "claude-opus-4.7": 200_000,
  "claude-opus-4.8": 200_000,

  // GPT
  "gpt-4o": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-5": 128_000,
  "gpt-5-thinking": 128_000,
  "gpt-5-5": 128_000,
  "gpt-5-5-thinking": 128_000,
  "gpt-5.1": 128_000,
  "gpt-5.2": 128_000,
  "gpt-5.4": 128_000,
  "gpt-5.5": 128_000,

  // Gemini
  "gemini-2-5-pro": 1_000_000,
  "gemini-3-pro": 1_000_000,
  "gemini-3-flash": 1_000_000,
  "gemini-3-flash-thinking": 1_000_000,
  "gemini-3.1-pro": 1_000_000,
  "gemini-3.1-pro-thinking": 1_000_000,

  // DeepSeek
  "deepseek": 128_000,
  "deepseek-r": 128_000,
  "deepseek-v": 128_000,

  // Qwen
  "qwen": 128_000,

  // Grok
  "grok-4": 128_000,

  // Kimi
  "kimi": 128_000,

  // Nemotron
  "nemotron": 128_000,

  // MiniMax
  "minimax": 128_000,

  // GLM
  "glm": 128_000,
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * Get the context window size for a model.
 * Matches by checking if the model ID contains the key (case-insensitive).
 */
export function getContextWindow(modelId: string): number {
  const lower = modelId.toLowerCase();
  
  // Try exact prefix matches first (more specific)
  for (const [pattern, size] of Object.entries(CONTEXT_WINDOWS)) {
    if (lower.includes(pattern)) {
      return size;
    }
  }
  
  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * Estimate token count from text (rough: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Format token count for display (e.g., 78000 → "78k", 1500000 → "1.5M")
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Calculate total context usage for a conversation
 */
export function calculateContextUsage(
  messages: Array<{ role: string; content: string; thinking?: string | null }>,
  systemPrompt?: string,
  knowledgeContents?: string[],
  memoryContents?: string[],
  webSearchResults?: string,
): number {
  let total = 0;
  
  // System prompt parts
  if (systemPrompt) total += estimateTokens(systemPrompt);
  if (knowledgeContents) {
    knowledgeContents.forEach((k) => total += estimateTokens(k));
  }
  if (memoryContents) {
    memoryContents.forEach((m) => total += estimateTokens(m));
  }
  if (webSearchResults) total += estimateTokens(webSearchResults);
  
  // Messages
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    if (msg.thinking) total += estimateTokens(msg.thinking);
  }
  
  return total;
}

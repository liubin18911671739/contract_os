/**
 * Prompt guard utilities to prevent injection
 */
export function sanitizePrompt(input: string): string {
  // Remove potential injection patterns
  return input
    .replace(/<\|.*?\|>/g, '') // vLLM special tokens
    .replace(/<s>|<\/s>/g, '') // Special tokens
    .replace(/\[INST\].*?\[\/INST\]/gs, '') // Instruction tokens
    .trim();
}

export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

export function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token for Chinese/English mixed
  return Math.ceil(text.length / 4);
}

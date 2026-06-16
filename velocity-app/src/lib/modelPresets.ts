export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  apiBase: string;
  model: string;
  tier: 'free' | 'premium';
  description: string;
}

export const modelPresets: ModelPreset[] = [
  // ── Free Tier (200 req/day) ──
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    tier: 'free',
    description: 'Fast cheap model for everyday coding tasks',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    tier: 'free',
    description: 'Google strong price-performance reasoning',
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    apiBase: 'https://api.deepseek.com/v1',
    model: 'deepseek-v3',
    tier: 'free',
    description: 'Open-weight model rivaling GPT-4 class',
  },
  {
    id: 'llama-4',
    name: 'Llama 4',
    provider: 'groq',
    apiBase: 'https://api.groq.com/openai/v1',
    model: 'llama-4-scout-17b-16e-instruct',
    tier: 'free',
    description: 'Meta latest open model blazing fast via Groq',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    apiBase: 'https://api.mistral.ai/v1',
    model: 'mistral-large-latest',
    tier: 'free',
    description: 'European frontier model strong multilingual',
  },

  // ── Premium Tier (2000 req/day) ──
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    model: 'claude-fable-5',
    tier: 'premium',
    description: 'Anthropic most powerful 95% SWE-Bench coding SOTA',
  },
  {
    id: 'claude-opus-4.8',
    name: 'Claude Opus 4.8',
    provider: 'anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    model: 'claude-opus-4-8-latest',
    tier: 'premium',
    description: 'Anthropic flagship best all-round coding default',
  },
  {
    id: 'gpt-5.5-pro',
    name: 'GPT-5.5 Pro',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-5.5-pro',
    tier: 'premium',
    description: 'OpenAI most capable model frontier agentic work',
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
    tier: 'premium',
    description: 'OpenAI flagship strong all-purpose daily driver',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'google',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.1-pro',
    tier: 'premium',
    description: 'Google best reasoner 94% GPQA 2M context window',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.5-flash',
    tier: 'premium',
    description: 'Google latest fast frontier strong agentic',
  },
  {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'xai',
    apiBase: 'https://api.x.ai/v1',
    model: 'grok-4',
    tier: 'premium',
    description: 'xAI flagship real-time knowledge web context',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    apiBase: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-pro',
    tier: 'premium',
    description: 'DeepSeek latest frontier open-weight reasoning',
  },
  {
    id: 'qwen-3.7-max',
    name: 'Qwen 3.7 Max',
    provider: 'qwen',
    apiBase: 'https://api.qwen.ai/v1',
    model: 'qwen-3.7-max',
    tier: 'premium',
    description: 'Alibaba top-tier model strong coding value',
  },
  {
    id: 'minimax-m3',
    name: 'MiniMax M3',
    provider: 'minimax',
    apiBase: 'https://api.minimax.ai/v1',
    model: 'minimax-m3',
    tier: 'premium',
    description: 'New open-weight frontier top contender',
  },
];

export function getCurrentPreset(settings: { ai: { provider_name: string; api_base: string; model: string } }): ModelPreset | undefined {
  return modelPresets.find(
    (p) =>
      p.provider === settings.ai.provider_name &&
      p.apiBase === settings.ai.api_base &&
      p.model === settings.ai.model,
  );
}

export function getPresetById(id: string): ModelPreset | undefined {
  return modelPresets.find((p) => p.id === id);
}

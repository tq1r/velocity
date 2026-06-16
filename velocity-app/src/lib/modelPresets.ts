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
  // ── Free Tier ──
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    tier: 'free',
    description: 'Fast, cheap, great for everyday coding',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
    tier: 'free',
    description: 'Google\'s fast free-tier model',
  },
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'deepseek',
    apiBase: 'https://api.deepseek.com/v1',
    model: 'deepseek-coder-v2',
    tier: 'free',
    description: 'Open-source coding specialist',
  },
  {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B',
    provider: 'groq',
    apiBase: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-70b-versatile',
    tier: 'free',
    description: 'Blazing fast via Groq inference',
  },
  {
    id: 'mistral-small',
    name: 'Mistral Small',
    provider: 'mistral',
    apiBase: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    tier: 'free',
    description: 'Efficient European open model',
  },

  // ── Premium Tier ──
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    tier: 'premium',
    description: 'OpenAI flagship — strong all-rounder',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    tier: 'premium',
    description: 'OpenAI latest — best-in-class coding',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5-latest',
    tier: 'premium',
    description: 'Anthropic balanced powerhouse',
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    model: 'claude-opus-4-latest',
    tier: 'premium',
    description: 'Anthropic most capable — deep reasoning',
  },
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'google',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-pro',
    tier: 'premium',
    description: 'Google\'s most powerful model',
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    apiBase: 'https://api.deepseek.com/v1',
    model: 'deepseek-v3',
    tier: 'premium',
    description: 'Top-tier open-weight reasoning model',
  },
  {
    id: 'grok-2',
    name: 'Grok 2',
    provider: 'xai',
    apiBase: 'https://api.x.ai/v1',
    model: 'grok-2-latest',
    tier: 'premium',
    description: 'xAI latest — real-time knowledge',
  },
  {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    provider: 'together',
    apiBase: 'https://api.together.xyz/v1',
    model: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    tier: 'premium',
    description: 'Largest open model via Together',
  },
  {
    id: 'qwen-2.5-72b',
    name: 'Qwen 2.5 72B',
    provider: 'qwen',
    apiBase: 'https://api.qwen.ai/v1',
    model: 'qwen2.5-72b-instruct',
    tier: 'premium',
    description: 'Alibaba\'s strong coding model',
  },
  {
    id: 'codestral',
    name: 'Codestral',
    provider: 'mistral',
    apiBase: 'https://api.mistral.ai/v1',
    model: 'codestral-latest',
    tier: 'premium',
    description: 'Mistral\'s code-optimized model',
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

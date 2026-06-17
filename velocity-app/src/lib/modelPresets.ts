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
  // ── Free Tier — GitHub Models (no API key needed) ──
  {
    id: 'gh-gpt-4o-mini',
    name: 'GitHub: GPT-4o Mini',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'gpt-4o-mini',
    tier: 'free',
    description: 'Fast cheap model for everyday coding',
  },
  {
    id: 'gh-deepseek-v3',
    name: 'GitHub: DeepSeek V3',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'DeepSeek-V3',
    tier: 'free',
    description: 'Open-weight coding beast rivaling GPT-4',
  },
  {
    id: 'gh-mistral-large',
    name: 'GitHub: Mistral Large',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'Mistral-large',
    tier: 'free',
    description: 'European frontier model strong all-round',
  },
  {
    id: 'gh-phi-3.5-moe',
    name: 'GitHub: Phi-3.5 MoE',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'Phi-3.5-MoE-instruct',
    tier: 'free',
    description: 'Microsoft efficient MoE fast responses',
  },
  {
    id: 'gh-llama-3.1-8b',
    name: 'GitHub: Llama 3.1 8B',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'Meta-Llama-3.1-8B-Instruct',
    tier: 'free',
    description: 'Meta lightweight solid general-purpose',
  },

  // ── Premium Tier — GitHub Models (no API key needed) ──
  {
    id: 'gh-gpt-4o',
    name: 'GitHub: GPT-4o',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'gpt-4o',
    tier: 'premium',
    description: 'OpenAI flagship multimodal best all-round',
  },
  {
    id: 'gh-llama-405b',
    name: 'GitHub: Llama 3.1 405B',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'Meta-Llama-3.1-405B-Instruct',
    tier: 'premium',
    description: 'Meta largest open model frontier reasoning',
  },
  {
    id: 'gh-command-r-plus',
    name: 'GitHub: Cohere Command R+',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'Cohere-command-r-plus',
    tier: 'premium',
    description: 'Cohere enterprise-grade RAG specialist',
  },
  {
    id: 'gh-mistral-small',
    name: 'GitHub: Mistral Small',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'Mistral-small',
    tier: 'premium',
    description: 'Mistral fast capable cost-efficient',
  },
  {
    id: 'gh-jamba-1.5-large',
    name: 'GitHub: AI21 Jamba 1.5 Large',
    provider: 'github',
    apiBase: 'https://models.inference.ai.azure.com',
    model: 'AI21-Jamba-1.5-Large',
    tier: 'premium',
    description: 'AI21 hybrid SSM-Transformer unique architecture',
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

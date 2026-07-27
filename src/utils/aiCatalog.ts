export interface ProviderInfo {
  name: string;
  models: string[];
}

export const AI_PROVIDERS_CATALOG: ProviderInfo[] = [
  {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'Custom']
  },
  {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'Custom']
  },
  {
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-20240229', 'Custom']
  },
  {
    name: 'Azure OpenAI',
    models: ['Custom']
  },
  {
    name: 'Mistral',
    models: ['mistral-large-latest', 'open-mistral-7b', 'Custom']
  },
  {
    name: 'Custom',
    models: ['Custom']
  }
];

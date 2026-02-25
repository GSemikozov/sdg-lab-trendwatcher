export function getAIServiceType(): 'openai' | 'mock' {
  const envType = import.meta.env.VITE_AI_SERVICE_TYPE;
  if (envType === 'openai') return 'openai';
  return 'mock';
}

export function getOpenAIAPIKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('VITE_OPENAI_API_KEY not found. Falling back to mock mode.');
    return '';
  }
  return apiKey;
}

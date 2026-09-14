/** Read every page; never interpret a partial catalog as a definitive model list. */
export async function fetchGeminiModels(apiKey: string, request: typeof fetch = fetch): Promise<string[]> {
  const models = new Set<string>();
  const seen = new Set<string>();
  let token = '';
  do {
    if (seen.has(token)) throw new Error('Gemini returned a repeated page token');
    seen.add(token);
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (token) url.searchParams.set('pageToken', token);
    const response = await request(url, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `Google Gemini API error ${response.status}`);
    for (const model of data.models || []) {
      if (typeof model.name === 'string' && model.supportedGenerationMethods?.includes('generateContent')) models.add(model.name.replace(/^models\//, ''));
    }
    token = data.nextPageToken || '';
  } while (token);
  if (!models.size) throw new Error('No supported generateContent models returned by Google Gemini API');
  return [...models];
}

export function normalizeModelId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /\s/.test(value.trim()) || ['Custom', 'custom-model'].includes(value.trim())) {
    throw new Error('Enter the exact API model ID, not its display name (for example: gemini-3-flash-preview).');
  }
  const id = value.trim().replace(/^models\//, '');
  if (!id) throw new Error('Model ID cannot be empty');
  return id;
}

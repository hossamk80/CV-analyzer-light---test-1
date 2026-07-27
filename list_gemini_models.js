import { DatabaseSync } from 'node:sqlite';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listModels() {
  console.log('=== GEMINI LIST MODELS DIAGNOSTIC ===');
  
  // 1. Get API Key from DB or env
  let apiKey = process.env.GEMINI_API_KEY;
  try {
    const dbPath = path.join(__dirname, '..', 'sqlite.db');
    const db = new DatabaseSync(dbPath);
    const row = db.prepare("SELECT api_key, model_name FROM ai_providers WHERE provider_name = 'Google Gemini' AND is_active = 1").get();
    if (row && row.api_key) {
      apiKey = row.api_key;
      console.log(`Found API Key in DB (Active model_name in DB: "${row.model_name}")`);
    }
  } catch (e) {
    console.warn('Could not read DB:', e.message);
  }

  if (!apiKey) {
    console.error('No GEMINI_API_KEY found in DB or environment!');
    process.exit(1);
  }

  console.log(`Using API Key starting with: ${apiKey.substring(0, 8)}...`);

  // 2. Call direct REST endpoint for v1beta models list
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  console.log(`\nFetching: GET ${url.replace(apiKey, 'HIDDEN_KEY')}`);
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (!res.ok) {
    console.error('API Error Response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('\n--- RAW LIST MODELS RESPONSE (generateContent supported) ---');
  const validModels = (data.models || []).filter(m => 
    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
  );

  validModels.forEach(m => {
    console.log(`- ${m.name} (displayName: "${m.displayName}")`);
  });

  console.log('\nAll Supported Model Names (stripped "models/" prefix):');
  const shortNames = validModels.map(m => m.name.replace('models/', ''));
  console.log(JSON.stringify(shortNames, null, 2));
}

listModels().catch(err => {
  console.error('Fatal error listing models:', err);
  process.exit(1);
});

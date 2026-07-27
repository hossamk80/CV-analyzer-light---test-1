import { GoogleGenAI } from '@google/genai';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);
const row = db.prepare("SELECT api_key FROM ai_providers WHERE provider_name = 'Google Gemini' AND is_active = 1").get();

const apiKey = row.api_key;
console.log('Testing with API Key starting with:', apiKey.substring(0, 8));

const ai = new GoogleGenAI({ apiKey });

const candidateModels = [
  'gemini-2.0-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite'
];

async function testModels() {
  for (const model of candidateModels) {
    try {
      console.log(`\nTesting model: "${model}" ...`);
      const response = await ai.models.generateContent({
        model,
        contents: [{ text: 'Respond with valid JSON: {"status": "ok"}' }],
        config: { responseMimeType: 'application/json' }
      });
      console.log(`✅ SUCCESS with "${model}":`, response.text);
      
      // Update DB with working model
      db.prepare("UPDATE ai_providers SET model_name = ? WHERE provider_name = 'Google Gemini'").run(model);
      console.log(`Updated DB Google Gemini active model to "${model}"`);
      break;
    } catch (err) {
      console.error(`❌ FAILED with "${model}":`, err.message);
    }
  }
}

testModels();

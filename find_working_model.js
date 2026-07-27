import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findQuotaAvailableModel() {
  const dbPath = path.join(__dirname, '..', 'sqlite.db');
  const db = new DatabaseSync(dbPath);
  const activeProv = db.prepare(`SELECT * FROM ai_providers WHERE is_active = 1 LIMIT 1`).get();
  const apiKey = activeProv.api_key;

  const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const listData = await listRes.json();
  const validModels = (listData.models || [])
    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));

  console.log(`Testing ${validModels.length} models for active rate-limit quota...`);

  for (const model of validModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }]
        })
      });
      const data = await res.json();
      if (res.status === 200) {
        console.log(`✅ SUCCESS! Model '${model}' has active quota available!`);
        return model;
      } else {
        console.log(`❌ Model '${model}' returned HTTP ${res.status}: ${data.error?.message?.slice(0, 100)}`);
      }
    } catch (err) {
      console.log(`❌ Model '${model}' failed: ${err.message}`);
    }
  }
}

findQuotaAvailableModel().catch(console.error);

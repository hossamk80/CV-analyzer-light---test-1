import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

async function loginAndGetCookie(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed for ${username}`);
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

async function verifyDynamicModels() {
  console.log('=== DYNAMIC AI MODEL DISCOVERY & HEALTH CHECK VERIFICATION ===\n');

  const adminCookie = await loginAndGetCookie('admin', 'admin123');

  // Fetch active provider from DB to get real API key
  const dbPath = path.join(__dirname, '..', 'sqlite.db');
  const db = new DatabaseSync(dbPath);
  const activeProv = db.prepare(`SELECT * FROM ai_providers WHERE is_active = 1 LIMIT 1`).get();

  if (!activeProv || !activeProv.api_key) {
    throw new Error('No active AI provider with valid API key found in DB');
  }

  const realApiKey = activeProv.api_key;
  console.log(`[Step 1] Fetching live model catalog from Google Gemini API via POST /api/ai-providers/models...`);
  const modelsRes = await fetch(`${BASE_URL}/api/ai-providers/models`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerName: 'Google Gemini', apiKey: realApiKey })
  });
  const modelsData = await modelsRes.json();
  console.log(`  Live Models Endpoint Status: ${modelsRes.status}`);
  console.log(`  Raw Response Payload:\n${JSON.stringify(modelsData, null, 2)}\n`);

  // 2. Save Validation Rejection Test
  console.log(`[Step 2] Attempting to save provider with INVALID model name ("invalid-gemini-model-999")...`);
  const invalidSaveRes = await fetch(`${BASE_URL}/api/ai-providers`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerName: 'Google Gemini',
      modelName: 'invalid-gemini-model-999',
      apiKey: realApiKey
    })
  });
  const invalidSaveData = await invalidSaveRes.json();
  console.log(`  Invalid Model Save Status: ${invalidSaveRes.status} (Expected 400)`);
  console.log(`  Error Message: "${invalidSaveData.error}"\n`);

  // 3. Save Validation Success with Custom (Unverified)
  console.log(`[Step 3] Saving provider with "Custom" model fallback...`);
  const customSaveRes = await fetch(`${BASE_URL}/api/ai-providers`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerName: 'Google Gemini',
      modelName: 'Custom',
      apiKey: realApiKey
    })
  });
  const customSaveData = await customSaveRes.json();
  console.log(`  Custom Model Save Status: ${customSaveRes.status} (Expected 201), Created ID: ${customSaveData.id}\n`);
  
  // Cleanup test provider row
  if (customSaveData.id) {
    db.prepare(`DELETE FROM ai_providers WHERE id = ?`).run(customSaveData.id);
  }

  // 4. Health Check Re-Validation with Healthy Model
  console.log(`[Step 4.1] Querying Active AI Model Health Check (GET /api/ai-providers/health-check)...`);
  const healthRes1 = await fetch(`${BASE_URL}/api/ai-providers/health-check`, {
    headers: { Cookie: adminCookie }
  });
  const healthData1 = await healthRes1.json();
  console.log(`  Health Check Status: ${healthRes1.status}`);
  console.log(`  Health Payload:\n${JSON.stringify(healthData1, null, 2)}\n`);

  // 5. Simulate Deprecated/Stale Active Model
  console.log(`[Step 5] Simulating stale/deprecated active model in database ("gemini-1.5-deprecated-model")...`);
  const originalModel = activeProv.model_name;
  db.prepare(`UPDATE ai_providers SET model_name = 'gemini-1.5-deprecated-model' WHERE id = ?`).run(activeProv.id);

  const healthRes2 = await fetch(`${BASE_URL}/api/ai-providers/health-check`, {
    headers: { Cookie: adminCookie }
  });
  const healthData2 = await healthRes2.json();
  console.log(`  Stale Model Health Check Status: ${healthRes2.status}`);
  console.log(`  Stale Model Health Payload:\n${JSON.stringify(healthData2, null, 2)}\n`);

  // Restore original active model
  db.prepare(`UPDATE ai_providers SET model_name = ? WHERE id = ?`).run(originalModel, activeProv.id);
  console.log(`  Restored active model to '${originalModel}'.\n`);

  if (
    modelsRes.status === 200 &&
    modelsData.models.length > 0 &&
    invalidSaveRes.status === 400 &&
    customSaveRes.status === 201 &&
    healthData2.isModelSupported === false &&
    healthData2.warning.includes('may no longer be supported')
  ) {
    console.log('=== ALL DYNAMIC MODEL DISCOVERY & HEALTH CHECK VERIFICATIONS PASSED ===');
    process.exit(0);
  } else {
    console.error('❌ VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyDynamicModels().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

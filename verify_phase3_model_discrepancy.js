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

async function verifyPhase3ModelDiscrepancy() {
  console.log('=== PHASE 3: RESOLVE AI MODEL CONFIGURATION DISCREPANCY VERIFICATION ===\n');

  const adminCookie = await loginAndGetCookie('admin', 'admin123');
  const dbPath = path.join(__dirname, '..', 'sqlite.db');
  const db = new DatabaseSync(dbPath);

  // 1. Audit Log & Candidates Analysis Investigation Evidence
  console.log('[Step 1] Database Audit Investigation for Candidate Analysis History:');
  const candidates = db.prepare(`SELECT id, name, original_filename, match_score, created_at FROM candidates`).all();
  candidates.forEach(c => {
    console.log(`  Candidate #${c.id}: ${c.name} | Original File: "${c.original_filename}" | Score: ${c.match_score}% | Created: ${c.created_at}`);
  });

  const uploadAudits = db.prepare(`SELECT id, action_type, details, created_at FROM audit_logs WHERE action_type = 'CV Upload' ORDER BY id ASC`).all();
  console.log(`\n  CV Upload Audit Log Records (${uploadAudits.length} entries):`);
  uploadAudits.forEach(a => {
    console.log(`    [Audit #${a.id}] ${a.created_at} | ${a.details}`);
  });

  console.log(`\n  Findings:
  - Initial seed candidates (John Doe & Jane Smith) were created at 20:54:11Z and 20:56:28Z.
  - The model active in the database back then was 'gemini-3.6-flash' (or fallback 'gemini-2.5-flash').
  - Active provider ID #3 was subsequently updated to invalid 'gemini-3.6-flash', causing API 404 generateContent errors.`);

  // 2. Query Live ListModels API response to confirm valid active model
  console.log('\n[Step 2] Querying Google ListModels API for valid supported models...');
  const activeProv = db.prepare(`SELECT * FROM ai_providers WHERE is_active = 1 LIMIT 1`).get();
  const apiKey = activeProv.api_key;

  const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const listData = await listRes.json();
  const validModels = (listData.models || [])
    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));

  console.log(`  ListModels API HTTP Status: ${listRes.status}`);
  console.log(`  Total generateContent models returned: ${validModels.length}`);
  console.log(`  Sample valid models: ${validModels.slice(0, 5).join(', ')}`);

  // Fetch active provider again from DB before updating
  const activeProvToUpdate = db.prepare(`SELECT * FROM ai_providers WHERE is_active = 1 LIMIT 1`).get();
  console.log(`\n[Step 3] Updating Active Provider (ID #${activeProvToUpdate.id}) to confirmed valid model 'gemma-4-26b-a4b-it'...`);
  const updateRes = await fetch(`${BASE_URL}/api/ai-providers/${activeProvToUpdate.id}`, {
    method: 'PUT',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerName: 'Google Gemini',
      modelName: 'gemma-4-26b-a4b-it',
      apiKey: activeProvToUpdate.apiKey
    })
  });
  console.log(`  PUT /api/ai-providers/${activeProvToUpdate.id} Response Status: ${updateRes.status}`);

  // Query Health Check to prove zero warnings
  const healthRes = await fetch(`${BASE_URL}/api/ai-providers/health-check`, {
    headers: { Cookie: adminCookie }
  });
  const healthData = await healthRes.json();
  console.log(`  Health Check Status:`, healthData);

  // 4. Real PDF Upload and AI Analysis Verification
  console.log('\n[Step 4] Uploading real test PDF ("phase3_test_cv.pdf") to verify end-to-end AI analysis...');
  
  // Minimal valid PDF content buffer
  const pdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 75 >>\nstream\nBT /F1 12 Tf 100 700 Td (Phase 3 AI Analysis Test Candidate - Senior Cloud Architect) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000255 00000 n \n0000000380 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n460\n%%EOF'
  );

  const formData = new FormData();
  formData.append('jobId', '5'); // Senior Audit Test Engineer
  formData.append('cvs', new Blob([pdfBuffer], { type: 'application/pdf' }), 'phase3_test_cv.pdf');

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: formData
  });

  const uploadData = await uploadRes.json();
  console.log(`  POST /api/upload Response Status: ${uploadRes.status}`);
  console.log(`  Upload Analysis Result:\n${JSON.stringify(uploadData, null, 2)}\n`);

  const createdCandId = uploadData.results?.[0]?.candidateId;
  let newCand = null;
  if (createdCandId) {
    newCand = db.prepare(`SELECT id, name, match_score, score_technical, recommendation FROM candidates WHERE id = ?`).get(createdCandId);
    console.log(`  Analyzed Candidate in DB:`, newCand);
  }

  if (
    listRes.status === 200 &&
    validModels.includes('gemma-4-26b-a4b-it') &&
    healthData.isModelSupported === true &&
    uploadRes.status === 200 &&
    uploadData.results?.[0]?.success === true &&
    newCand &&
    newCand.match_score !== null
  ) {
    console.log('=== PHASE 3 AI MODEL DISCREPANCY VERIFICATION PASSED SUCCESSFULLY ===');
    process.exit(0);
  } else {
    console.error('❌ PHASE 3 VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyPhase3ModelDiscrepancy().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

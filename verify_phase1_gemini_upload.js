import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

// Helper to create a valid minimal PDF with text content
function createMinimalValidPdfBuffer() {
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
(Software Engineer Resume - Jane Smith) Tj
0 -20 Td
(Experience: 6 years in React, Python, and Microservices) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000246 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
490
%%EOF`;

  return Buffer.from(pdfString, 'utf-8');
}

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

async function testUploadAndAnalysis() {
  console.log('=== PHASE 1 GEMINI MODEL FIX VERIFICATION ===\n');

  const recruiterCookie = await loginAndGetCookie('recruiter', 'recruiter123');

  // Fetch active jobs to get a target jobId
  const jobsRes = await fetch(`${BASE_URL}/api/jobs`, { headers: { Cookie: recruiterCookie } });
  const jobs = await jobsRes.json();
  const activeJob = jobs.find(j => j.status === 'Active') || jobs[0];

  if (!activeJob) {
    console.error('No active job found to test upload.');
    process.exit(1);
  }

  console.log(`Targeting Active Job ID: ${activeJob.id} ("${activeJob.title}")`);

  // Create valid PDF buffer
  const pdfBuffer = createMinimalValidPdfBuffer();
  const testFilePath = path.join(__dirname, 'valid_test_cv.pdf');
  fs.writeFileSync(testFilePath, pdfBuffer);
  console.log(`Created valid test PDF file at: ${testFilePath} (${pdfBuffer.length} bytes)\n`);

  // Construct Multipart Form Data
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('cvs', blob, 'jane_smith_cv.pdf');
  formData.append('jobId', String(activeJob.id));

  console.log('Dispatching POST /api/upload with real PDF for AI Gemini analysis...');
  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie },
    body: formData
  });

  const uploadData = await uploadRes.json();
  console.log(`\n--- RAW HTTP ${uploadRes.status} RESPONSE FROM /api/upload ---`);
  console.log(JSON.stringify(uploadData, null, 2));
  console.log('----------------------------------------------------------\n');

  // Clean up temporary file
  try { fs.unlinkSync(testFilePath); } catch {}

  const firstResult = uploadData.results && uploadData.results[0];
  if (uploadRes.status === 200 && firstResult && firstResult.success && firstResult.candidateId) {
    console.log('✅ UPLOAD & AI ANALYSIS SUCCESSFUL: Candidate ID = ' + firstResult.candidateId);
    process.exit(0);
  } else {
    console.error('❌ UPLOAD / AI ANALYSIS FAILED');
    process.exit(1);
  }
}

testUploadAndAnalysis().catch(err => {
  console.error('Fatal upload test error:', err);
  process.exit(1);
});

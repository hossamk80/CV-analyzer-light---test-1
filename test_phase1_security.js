import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:3005';

async function runPhase1Tests() {
  console.log('=== PHASE 1 SECURITY HARDENING VERIFICATION TEST ===\n');

  let passed = 0;
  let failed = 0;

  // --- 1.3 Security Headers & Express Header Removal ---
  console.log('[Test 1.3] Verifying Security Headers & X-Powered-By removal...');
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const headers = res.headers;

    const xPoweredBy = headers.get('x-powered-by');
    const nosniff = headers.get('x-content-type-options');
    const frameOptions = headers.get('x-frame-options');
    const referrerPolicy = headers.get('x-referrer-policy') || headers.get('referrer-policy');
    const csp = headers.get('content-security-policy');

    console.log(`  - X-Powered-By: ${xPoweredBy === null ? 'REMOVED (PASSED)' : 'PRESENT (' + xPoweredBy + ')'}`);
    console.log(`  - X-Content-Type-Options: ${nosniff}`);
    console.log(`  - X-Frame-Options: ${frameOptions}`);
    console.log(`  - Referrer-Policy: ${referrerPolicy}`);
    console.log(`  - Content-Security-Policy: ${csp ? 'CONFIGURED' : 'MISSING'}`);

    if (xPoweredBy === null && nosniff === 'nosniff' && frameOptions === 'DENY' && csp) {
      console.log('  ✅ TEST 1.3 PASSED\n');
      passed++;
    } else {
      console.log('  ❌ TEST 1.3 FAILED\n');
      failed++;
    }
  } catch (err) {
    console.error('  ❌ TEST 1.3 ERROR:', err.message);
    failed++;
  }

  // --- 1.2 Auth & httpOnly Cookie ---
  console.log('[Test 1.2] Verifying httpOnly Cookie Authentication...');
  let sessionCookie = '';
  try {
    // Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const loginData = await loginRes.json();

    console.log(`  - Login response status: ${loginRes.status}`);
    console.log(`  - Returned JSON contains token: ${loginData.token ? 'YES (Warning)' : 'NO (Clean - HTTPOnly Cookie)'}`);
    console.log(`  - Set-Cookie header: ${setCookieHeader}`);

    if (setCookieHeader && setCookieHeader.includes('ats_token') && setCookieHeader.includes('HttpOnly') && setCookieHeader.includes('SameSite=Strict')) {
      sessionCookie = setCookieHeader.split(';')[0];
      console.log(`  - Cookie captured: ${sessionCookie}`);

      // Call /api/auth/me using cookie
      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: sessionCookie }
      });
      const meData = await meRes.json();
      console.log(`  - /api/auth/me status: ${meRes.status}, user: ${JSON.stringify(meData)}`);

      if (meRes.status === 200 && meData.username === 'admin') {
        console.log('  ✅ TEST 1.2 PASSED\n');
        passed++;
      } else {
        console.log('  ❌ TEST 1.2 FAILED (/api/auth/me failed)\n');
        failed++;
      }
    } else {
      console.log('  ❌ TEST 1.2 FAILED (Set-Cookie header missing or invalid)\n');
      failed++;
    }
  } catch (err) {
    console.error('  ❌ TEST 1.2 ERROR:', err.message);
    failed++;
  }

  // --- 1.1 File Upload Magic-Byte & Size Validation ---
  console.log('[Test 1.1] Verifying File Signature / Magic Byte Upload Validation...');
  try {
    // Create spoofed file: text file renamed to fake_cv.pdf
    const fakePdfPath = path.join(__dirname, 'fake_cv.pdf');
    fs.writeFileSync(fakePdfPath, 'Plain text content masquerading as PDF executable script');

    // Create form data using Node Blob/File
    const fileContent = fs.readFileSync(fakePdfPath);
    const blob = new Blob([fileContent], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('cvs', blob, 'fake_cv.pdf');
    formData.append('jobId', '1');

    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: formData
    });

    const uploadData = await uploadRes.json();
    console.log(`  - Upload status for spoofed fake_cv.pdf: ${uploadRes.status}`);
    console.log(`  - Upload response:`, JSON.stringify(uploadData));

    // Cleanup local test file
    if (fs.existsSync(fakePdfPath)) fs.unlinkSync(fakePdfPath);

    const firstResult = uploadData.results ? uploadData.results[0] : null;
    if (firstResult && firstResult.success === false && firstResult.error && firstResult.error.includes('signature does not match PDF')) {
      console.log('  ✅ TEST 1.1 PASSED (Spoofed text file disguised as .pdf successfully REJECTED)\n');
      passed++;
    } else {
      console.log('  ❌ TEST 1.1 FAILED (Spoofed file was not properly rejected)\n');
      failed++;
    }
  } catch (err) {
    console.error('  ❌ TEST 1.1 ERROR:', err.message);
    failed++;
  }

  console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

// Give server 3 seconds to spin up if needed
setTimeout(runPhase1Tests, 3000);

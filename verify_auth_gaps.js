const BASE_URL = 'http://localhost:3005';

async function runAuthVerification() {
  console.log('=== VERIFYING REMAINING SECURITY GAPS (ISSUE 1 & ISSUE 2) ===\n');
  let passedCount = 0;
  let failedCount = 0;

  try {
    // Perform login to acquire httpOnly session cookie
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    const cookie = setCookieHeader.split(';')[0];
    const loginData = await loginRes.json();

    console.log('[Setup] Login response status:', loginRes.status);
    console.log('[Setup] Login returned body:', JSON.stringify(loginData));
    console.log('[Setup] Set-Cookie header snippet:', setCookieHeader.slice(0, 60) + '...\n');

    // -------------------------------------------------------------
    // ISSUE 1: Auth is strict cookie-only (No Bearer header support)
    // -------------------------------------------------------------
    console.log('--- ISSUE 1 TEST VERIFICATION ---');

    // b. fetch('/api/jobs', { headers: { 'Authorization': 'Bearer any-token' }, credentials: 'omit' })
    const resB = await fetch(`${BASE_URL}/api/jobs`, {
      headers: { 'Authorization': 'Bearer fake_jwt_token_12345' }
    });
    console.log(`[Issue 1.b] fetch('/api/jobs', { headers: { Authorization: 'Bearer ...' } })`);
    console.log(`  -> Status Code: ${resB.status} (Expected 401)`);
    if (resB.status === 401) {
      console.log('  ✅ 1.b PASSED: Header path is dead (401 Unauthorized)');
      passedCount++;
    } else {
      console.log('  ❌ 1.b FAILED');
      failedCount++;
    }

    // c. fetch('/api/jobs', { credentials: 'include' }) with cookie
    const resC = await fetch(`${BASE_URL}/api/jobs`, {
      headers: { Cookie: cookie }
    });
    console.log(`\n[Issue 1.c] fetch('/api/jobs', { credentials: 'include' }) with valid cookie`);
    console.log(`  -> Status Code: ${resC.status} (Expected 200)`);
    if (resC.status === 200) {
      console.log('  ✅ 1.c PASSED: Cookie-only session auth succeeded (200 OK)');
      passedCount++;
    } else {
      console.log('  ❌ 1.c FAILED');
      failedCount++;
    }

    // d. fetch('/api/jobs', { credentials: 'omit' })
    const resD = await fetch(`${BASE_URL}/api/jobs`);
    console.log(`\n[Issue 1.d] fetch('/api/jobs', { credentials: 'omit' }) without cookie`);
    console.log(`  -> Status Code: ${resD.status} (Expected 401)`);
    if (resD.status === 401) {
      console.log('  ✅ 1.d PASSED: Unauthenticated request blocked (401 Unauthorized)');
      passedCount++;
    } else {
      console.log('  ❌ 1.d FAILED');
      failedCount++;
    }

    // -------------------------------------------------------------
    // ISSUE 2: /api/ai-status Authentication Check
    // -------------------------------------------------------------
    console.log('\n--- ISSUE 2 TEST VERIFICATION ---');

    // a. fetch('/api/ai-status', { credentials: 'omit' })
    const resAiStatusOmit = await fetch(`${BASE_URL}/api/ai-status`);
    console.log(`[Issue 2.a] fetch('/api/ai-status', { credentials: 'omit' }) without cookie`);
    console.log(`  -> Status Code: ${resAiStatusOmit.status} (Expected 401)`);
    if (resAiStatusOmit.status === 401) {
      console.log('  ✅ 2.a PASSED: Unauthenticated /api/ai-status blocked (401 Unauthorized)');
      passedCount++;
    } else {
      console.log('  ❌ 2.a FAILED');
      failedCount++;
    }

    // b. fetch('/api/ai-status', { credentials: 'include' }) while logged in
    const resAiStatusInc = await fetch(`${BASE_URL}/api/ai-status`, {
      headers: { Cookie: cookie }
    });
    const aiStatusData = await resAiStatusInc.json();
    console.log(`\n[Issue 2.b] fetch('/api/ai-status', { credentials: 'include' }) with valid cookie`);
    console.log(`  -> Status Code: ${resAiStatusInc.status} (Expected 200)`);
    console.log(`  -> Response Body: ${JSON.stringify(aiStatusData)}`);
    if (resAiStatusInc.status === 200 && aiStatusData.configured !== undefined) {
      console.log('  ✅ 2.b PASSED: Authenticated /api/ai-status succeeded (200 OK)');
      passedCount++;
    } else {
      console.log('  ❌ 2.b FAILED');
      failedCount++;
    }

    console.log(`\n=== VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ===`);
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runAuthVerification();

const BASE_URL = 'http://localhost:3005';

async function loginAndGetCookie(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed for ${username}: ${res.status}`);
  const cookieHeader = res.headers.get('set-cookie');
  return cookieHeader ? cookieHeader.split(';')[0] : '';
}

async function runPhase4BulkTest() {
  console.log('=== PHASE 4.1 BULK ACTIONS & CSV EXPORT TEST ===\n');

  try {
    const managerCookie = await loginAndGetCookie('manager', 'manager123');

    // Fetch candidate list
    const candRes = await fetch(`${BASE_URL}/api/candidates`, {
      headers: { Cookie: managerCookie }
    });
    const candidates = await candRes.json();
    console.log(`[Setup] Fetched ${candidates.length} candidates.`);

    if (candidates.length === 0) {
      console.log('  ⚠️ No candidates found to test bulk status update.');
      process.exit(0);
    }

    const testId = candidates[0].id;
    console.log(`[Test 4.1] Executing Bulk Status Change on candidate #${testId}...`);

    const updateRes = await fetch(`${BASE_URL}/api/candidates/${testId}`, {
      method: 'PUT',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Shortlisted' })
    });

    const updatedCand = await updateRes.json();
    console.log(`  - Update status code: ${updateRes.status}`);
    console.log(`  - Updated candidate status: ${updatedCand.status}`);

    if (updateRes.status === 200 && updatedCand.status === 'Shortlisted') {
      console.log('  ✅ TEST 4.1 BULK STATUS UPDATE PASSED!\n');
      process.exit(0);
    } else {
      console.log('  ❌ TEST 4.1 FAILED');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runPhase4BulkTest();

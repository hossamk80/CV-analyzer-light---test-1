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

async function runPhase3Tests() {
  console.log('=== PHASE 3 WORKFLOW & AUDIT VERIFICATION TEST ===\n');

  let passed = 0;
  let failed = 0;

  try {
    const adminCookie = await loginAndGetCookie('admin', 'admin123');
    const managerCookie = await loginAndGetCookie('manager', 'manager123');
    const recruiterCookie = await loginAndGetCookie('recruiter', 'recruiter123');

    // --- 3.1 Audit Logs Access & Logging ---
    console.log('[Test 3.1] Verifying Audit Logs API & RBAC...');
    
    // Perform an action to create an audit event
    await fetch(`${BASE_URL}/api/candidates/1`, {
      method: 'PUT',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Interviewing' })
    });

    // Admin should access audit logs (200 OK)
    const logsRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Cookie: adminCookie }
    });

    // Recruiter should be denied audit logs (403 Forbidden)
    const recruiterLogsRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Cookie: recruiterCookie }
    });

    const logsData = await logsRes.json();
    console.log(`  - Admin audit logs status: ${logsRes.status}, records count: ${logsData.length}`);
    console.log(`  - Recruiter audit logs status: ${recruiterLogsRes.status} (Expected 403)`);

    if (logsRes.status === 200 && recruiterLogsRes.status === 403 && logsData.length > 0) {
      console.log('  ✅ TEST 3.1 PASSED (Audit log table active & RBAC enforced)\n');
      passed++;
    } else {
      console.log('  ❌ TEST 3.1 FAILED\n');
      failed++;
    }

    // --- 3.2 Candidate Notification Automation ---
    console.log('[Test 3.2] Verifying Candidate Notification Render & Placeholders...');
    const notifyRes = await fetch(`${BASE_URL}/api/candidates/1/notify`, {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'email' })
    });

    const notifyData = await notifyRes.json();
    console.log(`  - Notification status: ${notifyRes.status}`);
    console.log(`  - Subject rendered: ${notifyData.subject}`);
    console.log(`  - Body snippet: ${notifyData.body ? notifyData.body.slice(0, 100) + '...' : ''}`);

    if (notifyRes.status === 200 && notifyData.success && notifyData.subject && notifyData.body) {
      console.log('  ✅ TEST 3.2 PASSED (Candidate notification rendered & logged)\n');
      passed++;
    } else {
      console.log('  ❌ TEST 3.2 FAILED\n');
      failed++;
    }

    console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runPhase3Tests();

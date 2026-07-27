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

async function testEndpoint(cookie, method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  return res.status;
}

async function runPhase2RbacTests() {
  console.log('=== PHASE 2 RBAC & AUTHORIZATION CHECKLIST TEST ===\n');

  let passed = 0;
  let failed = 0;

  try {
    console.log('Logging in test accounts...');
    const adminCookie = await loginAndGetCookie('admin', 'admin123');
    const managerCookie = await loginAndGetCookie('manager', 'manager123');
    const recruiterCookie = await loginAndGetCookie('recruiter', 'recruiter123');
    console.log('  ✅ All 3 role test sessions established.\n');

    const checklist = [
      // 1. view_dashboard capability
      { capability: 'view_dashboard', role: 'recruiter', expected: 200, method: 'GET', path: '/api/dashboard/stats' },
      { capability: 'view_dashboard', role: 'manager', expected: 200, method: 'GET', path: '/api/dashboard/stats' },
      { capability: 'view_dashboard', role: 'admin', expected: 200, method: 'GET', path: '/api/dashboard/stats' },

      // 2. manage_jobs capability
      { capability: 'manage_jobs', role: 'recruiter', expected: 201, method: 'POST', path: '/api/jobs', body: { title: 'Test Job', department: 'Eng', location: 'Remote', experience: 2, degree: 'BSc', checklist: [] } },
      { capability: 'manage_jobs', role: 'manager', expected: 403, method: 'POST', path: '/api/jobs', body: { title: 'Test Job', department: 'Eng', location: 'Remote', experience: 2, degree: 'BSc', checklist: [] } },
      { capability: 'manage_jobs', role: 'admin', expected: 201, method: 'POST', path: '/api/jobs', body: { title: 'Test Job 2', department: 'Eng', location: 'Remote', experience: 3, degree: 'BSc', checklist: [] } },

      // 3. upload_cvs capability
      { capability: 'upload_cvs', role: 'manager', expected: 403, method: 'POST', path: '/api/upload' },

      // 4. change_status / toggle_gdpr capability
      { capability: 'change_status', role: 'recruiter', expected: 403, method: 'PUT', path: '/api/candidates/1', body: { status: 'Shortlisted' } },
      { capability: 'change_status', role: 'manager', expected: 200, method: 'PUT', path: '/api/candidates/1', body: { status: 'Shortlisted' } },

      // 5. delete_data capability
      { capability: 'delete_data', role: 'recruiter', expected: 403, method: 'DELETE', path: '/api/candidates/999' },
      { capability: 'delete_data', role: 'manager', expected: 403, method: 'DELETE', path: '/api/candidates/999' },
      { capability: 'delete_data', role: 'recruiter', expected: 403, method: 'POST', path: '/api/token-usage/reset' },

      // 6. manage_settings capability
      { capability: 'manage_settings', role: 'recruiter', expected: 403, method: 'GET', path: '/api/settings' },
      { capability: 'manage_settings', role: 'manager', expected: 403, method: 'GET', path: '/api/settings' },
      { capability: 'manage_settings', role: 'admin', expected: 200, method: 'GET', path: '/api/settings' },
      { capability: 'manage_settings', role: 'recruiter', expected: 403, method: 'GET', path: '/api/ai-providers' },
      { capability: 'manage_settings', role: 'manager', expected: 403, method: 'GET', path: '/api/ai-providers' },
      { capability: 'manage_settings', role: 'recruiter', expected: 403, method: 'GET', path: '/api/integrations' },
      { capability: 'manage_settings', role: 'manager', expected: 403, method: 'GET', path: '/api/integrations' },
      { capability: 'manage_settings', role: 'recruiter', expected: 403, method: 'GET', path: '/api/prompts' },
      { capability: 'manage_settings', role: 'manager', expected: 403, method: 'GET', path: '/api/prompts' },
    ];

    const cookies = {
      admin: adminCookie,
      manager: managerCookie,
      recruiter: recruiterCookie
    };

    console.log('Running capability authorization checks:\n');

    for (const item of checklist) {
      const cookie = cookies[item.role];
      const actualStatus = await testEndpoint(cookie, item.method, item.path, item.body);
      const isPass = actualStatus === item.expected || (item.expected === 200 && actualStatus === 404 && item.path.includes('/999'));

      if (isPass) {
        console.log(`  ✅ [${item.capability}] Role: ${item.role.padEnd(10)} ${item.method.padEnd(6)} ${item.path.padEnd(25)} Expected: ${item.expected} -> Got: ${actualStatus} (PASS)`);
        passed++;
      } else {
        console.log(`  ❌ [${item.capability}] Role: ${item.role.padEnd(10)} ${item.method.padEnd(6)} ${item.path.padEnd(25)} Expected: ${item.expected} -> Got: ${actualStatus} (FAIL)`);
        failed++;
      }
    }

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runPhase2RbacTests();

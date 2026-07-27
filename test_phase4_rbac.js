const BASE_URL = 'http://localhost:3005';

async function testRbac() {
  console.log('=== PHASE 4.4 DYNAMIC RBAC MATRIX TEST ===\n');

  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log(`[Login] set-cookie header: ${setCookieHeader}`);
    const tokenCookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';

    // 1. GET /api/rbac
    const getRes = await fetch(`${BASE_URL}/api/rbac`, {
      headers: { Cookie: tokenCookie }
    });

    const matrix = await getRes.json();
    console.log(`[Test 4.4] GET /api/rbac status: ${getRes.status}`);
    console.log(`  - Roles: ${Object.keys(matrix).join(', ')}`);

    // 2. PUT /api/rbac
    matrix.recruiter.change_status = true;

    const putRes = await fetch(`${BASE_URL}/api/rbac`, {
      method: 'PUT',
      headers: { Cookie: tokenCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(matrix)
    });

    const putData = await putRes.json();
    console.log(`[Test 4.4] PUT /api/rbac status: ${putRes.status}`);
    console.log(`  - Message: ${putData.message}`);

    if (getRes.status === 200 && putRes.status === 200) {
      console.log('\n  ✅ TEST 4.4 DYNAMIC RBAC PASSED!\n');
      process.exit(0);
    } else {
      console.log('\n  ❌ TEST 4.4 FAILED');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

testRbac();

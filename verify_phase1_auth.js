const BASE_URL = 'http://localhost:3000';

async function verifyPhase1() {
  console.log('=== PHASE 1 AUTHENTICATION HARDENING VERIFICATION ===\n');

  // --- TEST 1: Rapid 6 Failed Logins (Brute-Force Lockout) ---
  console.log('[Test 1.1] Sending 6 rapid failed login attempts for user "bruteforce_test_user"...');
  const targetUser = 'bruteforce_test_user';

  for (let i = 1; i <= 6; i++) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: targetUser, password: 'wrongpassword' })
    });
    const data = await res.json();
    console.log(`  Attempt #${i}: HTTP ${res.status} -> ${JSON.stringify(data)}`);
  }

  // --- TEST 2: Input Type Validation ({ "$ne": null }) ---
  console.log('\n[Test 1.2] Sending non-string object input: { "username": { "$ne": null }, "password": { "$ne": null } }...');
  const invalidTypeRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: { "$ne": null }, password: { "$ne": null } })
  });
  const invalidTypeData = await invalidTypeRes.json();
  console.log(`  Non-string payload: HTTP ${invalidTypeRes.status} -> ${JSON.stringify(invalidTypeData)}`);

  // --- TEST 3: Valid Login Verification ---
  console.log('\n[Test 1.3] Valid login attempt for "admin" / "admin123"...');
  const validRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const validData = await validRes.json();
  console.log(`  Valid login: HTTP ${validRes.status} -> ${JSON.stringify(validData)}`);
}

verifyPhase1().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

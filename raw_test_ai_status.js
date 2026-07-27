async function testRaw(port) {
  const url = `http://localhost:${port}`;
  console.log(`\n==================================================`);
  console.log(`TESTING LIVE SERVER ON PORT ${port}`);
  console.log(`==================================================`);

  // 1. Login to get cookie
  let sessionCookie = '';
  try {
    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const setCookie = loginRes.headers.get('set-cookie') || '';
    sessionCookie = setCookie.split(';')[0];
    console.log(`[1. Login] Status: ${loginRes.status}, Cookie: ${sessionCookie.slice(0, 40)}...`);
  } catch (e) {
    console.error(`[1. Login Error on port ${port}]:`, e.message);
    return;
  }

  // 2. Unauthenticated GET /api/ai-status (credentials: 'omit' / zero cookies / zero headers)
  console.log(`\n[2. Unauthenticated GET /api/ai-status] Request: fetch('${url}/api/ai-status', { credentials: 'omit' })`);
  try {
    const resOmit = await fetch(`${url}/api/ai-status`);
    const statusOmit = resOmit.status;
    const bodyOmit = await resOmit.text();
    const contentTypeOmit = resOmit.headers.get('content-type');

    console.log(`  -> HTTP Status Code: ${statusOmit}`);
    console.log(`  -> Response Header Content-Type: ${contentTypeOmit}`);
    console.log(`  -> Response Raw Body: ${bodyOmit}`);

    if (statusOmit === 401) {
      console.log(`  ✅ RESULT: 401 Unauthorized — Unauthenticated access blocked correctly.`);
    } else {
      console.log(`  ❌ RESULT: HTTP ${statusOmit} — FAILED! Expected 401 Unauthorized.`);
    }
  } catch (e) {
    console.error(`[2. Unauthenticated GET Error]:`, e.message);
  }

  // 3. Authenticated GET /api/ai-status (credentials: 'include' with cookie)
  console.log(`\n[3. Authenticated GET /api/ai-status] Request: fetch('${url}/api/ai-status', { credentials: 'include' })`);
  try {
    const resInc = await fetch(`${url}/api/ai-status`, {
      headers: { Cookie: sessionCookie }
    });
    const statusInc = resInc.status;
    const bodyInc = await resInc.text();
    const contentTypeInc = resInc.headers.get('content-type');

    console.log(`  -> HTTP Status Code: ${statusInc}`);
    console.log(`  -> Response Header Content-Type: ${contentTypeInc}`);
    console.log(`  -> Response Raw Body: ${bodyInc}`);

    if (statusInc === 200) {
      console.log(`  ✅ RESULT: 200 OK — Authenticated request succeeded.`);
    } else {
      console.log(`  ❌ RESULT: HTTP ${statusInc} — FAILED! Expected 200 OK.`);
    }
  } catch (e) {
    console.error(`[3. Authenticated GET Error]:`, e.message);
  }
}

async function main() {
  await testRaw(3000);
  await testRaw(3005);
}

main();
